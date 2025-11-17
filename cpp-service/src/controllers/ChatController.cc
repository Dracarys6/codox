#include "ChatController.h"

#include <drogon/drogon.h>
#include <drogon/orm/DbClient.h>
#include <json/json.h>

#include <sstream>
#include <vector>

#include "../utils/PermissionUtils.h"
#include "../utils/ResponseUtils.h"

void ChatController::createRoom(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 2.解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    std::string name = json["name"].asString();
    std::string type = json.get("type", "group").asString();  // direct,group,document
    int docId = json["doc_id"].asInt();
    Json::Value memberIdsArray = json.get("member_ids", Json::arrayValue);

    // 验证类型
    if (type != "direct" && type != "group" && type != "document") {
        ResponseUtils::sendError(callback, "Invalid room type. Must be 'direct', 'group' or 'document'",
                                 k400BadRequest);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 如果是文档聊天室,验证文档访问权限(需要owner)
    if (type == "document" && docId > 0) {
        PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
            if (!hasPermission) {
                ResponseUtils::sendError(*callbackPtr, "No permission to create chat room for this document",
                                         k403Forbidden);
                return;
            }
            createRoomInDb(userId, name, type, docId, memberIdsArray, callbackPtr);
        });
        return;  // 文档聊天室需要等待权限检查完成
    }

    // 非文档聊天室,直接创建
    createRoomInDb(userId, name, type, docId, memberIdsArray, callbackPtr);
}

void ChatController::createRoomInDb(int userId, const std::string& name, const std::string& type, int docId,
                                    const Json::Value& memberIdsArray,
                                    std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr) {
    // 1.创建聊天室
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
        return;
    }

    std::string userIdStr = std::to_string(userId);
    std::string nameStr = name.empty() ? "" : name;
    std::string typeStr = type;
    std::string docIdStr = std::to_string(docId);

    // 根据 docId 是否为0决定是否插入 doc_id 字段
    std::string sql;
    if (docId > 0) {
        sql = "INSERT INTO chat_room (name, type, doc_id, created_by, created_at, updated_at) "
              "VALUES ($1, $2, $3::bigint, $4::bigint, NOW(), NOW()) RETURNING id";
    } else {
        sql = "INSERT INTO chat_room (name, type, created_by, created_at, updated_at) "
              "VALUES ($1, $2, $3::bigint, NOW(), NOW()) RETURNING id";
    }

    // 根据 docId 是否为0使用不同的参数列表
    if (docId > 0) {
        db->execSqlAsync(
                sql,
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Failed to create room", k500InternalServerError);
                        return;
                    }
                    int roomId = r[0]["id"].as<int>();

                    // 2.添加创建者为成员
                    std::vector<int> memberIds = {userId};
                    for (const auto& id : memberIdsArray) {
                        int memberId = id.asInt();
                        if (memberId != userId) {
                            memberIds.push_back(memberId);
                        }
                    }

                    // 3.批量添加成员
                    addMembersToRoom(roomId, memberIds, callbackPtr, [=](int roomId) {
                        // 4.返回创建的聊天室信息
                        Json::Value responseJson;
                        responseJson["id"] = roomId;
                        responseJson["name"] = name;
                        responseJson["type"] = type;
                        responseJson["doc_id"] = docId;
                        responseJson["created_by"] = userId;
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                    });
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                nameStr, typeStr, docIdStr, userIdStr);
    } else {
        db->execSqlAsync(
                sql,
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Failed to create room", k500InternalServerError);
                        return;
                    }
                    int roomId = r[0]["id"].as<int>();

                    // 2.添加创建者为成员
                    std::vector<int> memberIds = {userId};
                    for (const auto& id : memberIdsArray) {
                        int memberId = id.asInt();
                        if (memberId != userId) {
                            memberIds.push_back(memberId);
                        }
                    }

                    // 3.批量添加成员
                    addMembersToRoom(roomId, memberIds, callbackPtr, [=](int roomId) {
                        // 4.返回创建的聊天室信息
                        Json::Value responseJson;
                        responseJson["id"] = roomId;
                        responseJson["name"] = name;
                        responseJson["type"] = type;
                        responseJson["created_by"] = userId;
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                    });
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                nameStr, typeStr, userIdStr);
    }
}

void ChatController::addMembersToRoom(int roomId, const std::vector<int>& memberIds,
                                      std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr,
                                      std::function<void(int)> onSuccess) {
    if (memberIds.empty()) {
        onSuccess(roomId);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
        return;
    }

    // 使用 PostgreSQL 的 UNNEST 函数进行批量插入
    std::stringstream ss;
    ss << "INSERT INTO chat_room_member (room_id, user_id, joined_at) "
       << "SELECT $1::bigint, unnest($2::bigint[]), NOW() "
       << "ON CONFLICT (room_id, user_id) DO NOTHING";

    // 构建数组字符串格式: {1,2,3}
    std::stringstream arrayStr;
    arrayStr << "{";
    for (size_t i = 0; i < memberIds.size(); i++) {
        if (i > 0) arrayStr << ",";
        arrayStr << memberIds[i];
    }
    arrayStr << "}";

    db->execSqlAsync(
            ss.str(), [=](const drogon::orm::Result& r) { onSuccess(roomId); },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Failed to add members: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(roomId), arrayStr.str());
}

void ChatController::getRooms(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    // 2.解析分页参数
    int page = 1, pageSize = 20;
    std::string pageStr = req->getParameter("page");
    std::string pageSizeStr = req->getParameter("page_size");
    try {
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {
    }
    try {
        if (!pageSizeStr.empty()) pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
    } catch (...) {
    }

    int offset = (page - 1) * pageSize;

    // 3.查询聊天室列表
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT r.id, r.name, r.type, r.doc_id, r.created_by, r.created_at, r.updated_at, "
            "       (SELECT content FROM chat_message WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as "
            "last_message_content, "
            "       (SELECT created_at FROM chat_message WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as "
            "last_message_time, "
            "       (SELECT COUNT(*) FROM chat_message m "
            "        LEFT JOIN chat_message_read mr ON m.id = mr.message_id AND mr.user_id = $1 "
            "        WHERE m.room_id = r.id AND mr.id IS NULL) as unread_count "
            "FROM chat_room r "
            "INNER JOIN chat_room_member m ON r.id = m.room_id "
            "WHERE m.user_id = $1 "
            "ORDER BY COALESCE((SELECT created_at FROM chat_message WHERE room_id = r.id ORDER BY created_at DESC "
            "LIMIT 1), r.created_at) DESC "
            "LIMIT $2::integer OFFSET $3::integer",
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                Json::Value roomsArray(Json::arrayValue);

                for (const auto& row : r) {
                    Json::Value roomJson;
                    roomJson["id"] = row["id"].as<int>();
                    if (!row["name"].isNull()) {
                        roomJson["name"] = row["name"].as<std::string>();
                    }
                    roomJson["type"] = row["type"].as<std::string>();
                    if (!row["doc_id"].isNull()) {
                        roomJson["doc_id"] = row["doc_id"].as<int>();
                    }
                    roomJson["created_by"] = row["created_by"].as<int>();
                    roomJson["created_at"] = row["created_at"].as<std::string>();
                    roomJson["updated_at"] = row["updated_at"].as<std::string>();

                    if (!row["last_message_content"].isNull()) {
                        roomJson["last_message"] = row["last_message_content"].as<std::string>();
                    }
                    if (!row["last_message_time"].isNull()) {
                        roomJson["last_message_time"] = row["last_message_time"].as<std::string>();
                    }
                    roomJson["unread_count"] = row["unread_count"].as<int>();

                    roomsArray.append(roomJson);
                }

                responseJson["rooms"] = roomsArray;
                responseJson["page"] = page;
                responseJson["page_size"] = pageSize;

                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, std::to_string(pageSize), std::to_string(offset));
}

void ChatController::addMember(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数(房间ID)
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Room ID is required", k400BadRequest);
        return;
    }
    std::string roomIdStr = routingParams[0];
    int roomId = std::stoi(roomIdStr);

    // 2.获取 user_id (查询参数)
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3.解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    if (!json.isMember("user_ids") || !json["user_ids"].isArray()) {
        ResponseUtils::sendError(callback, "user_ids array is required", k400BadRequest);
        return;
    }

    // 4.验证当前用户是聊天室成员
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT id FROM chat_room_member WHERE room_id = $1 AND user_id = $2",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "You are not a member of this room", k403Forbidden);
                    return;
                }

                // 5. 添加新成员
                Json::Value idsArray = json["user_ids"];
                std::vector<int> memberIds;
                for (const auto& id : idsArray) {
                    memberIds.push_back(id.asInt());
                }

                addMembersToRoom(roomId, memberIds, callbackPtr, [=](int) {
                    Json::Value responseJson;
                    responseJson["message"] = "Members added successfully";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                });
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(roomId), std::to_string(userId));
}

void ChatController::getMessages(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数(房间ID）
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Room ID is required", k400BadRequest);
        return;
    }
    std::string roomIdStr = routingParams[0];
    int roomId = std::stoi(roomIdStr);

    // 2. 获取user_id(查询参数)
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID is required", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 解析分页参数
    int page = 1, pageSize = 50, beforeId = 0;

    std::string pageStr = req->getParameter("page");
    std::string pageSizeStr = req->getParameter("page_size");
    std::string beforeIdStr = req->getParameter("before_id");

    try {
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {
    }
    try {
        if (!pageSizeStr.empty()) pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
    } catch (...) {
    }
    try {
        if (!beforeIdStr.empty()) beforeId = std::stoi(beforeIdStr);
    } catch (...) {
    }

    // 4. 验证用户是聊天室成员
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT id FROM chat_room_member WHERE room_id = $1 AND user_id = $2",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "You are not a member of this room", k403Forbidden);
                    return;
                }

                // 5. 查询消息历史
                std::string sql;
                std::string userIdParamStr = std::to_string(userId);
                std::string roomIdParamStr = std::to_string(roomId);
                std::string pageSizeParamStr = std::to_string(pageSize);

                if (beforeId > 0) {
                    // 游标分页
                    sql = "SELECT m.id, m.sender_id, m.content, m.message_type, m.file_url, m.reply_to, m.created_at, "
                          "       u.nickname, u.avatar_url, "
                          "       (SELECT COUNT(*) FROM chat_message_read WHERE message_id = m.id AND user_id = "
                          "$3::bigint) > "
                          "0 as is_read "
                          "FROM chat_message m "
                          "LEFT JOIN user_profile u ON m.sender_id = u.user_id "
                          "WHERE m.room_id = $1::bigint AND m.id < $4::bigint "
                          "ORDER BY m.created_at DESC "
                          "LIMIT $2::integer";

                    db->execSqlAsync(
                            sql,
                            [=](const drogon::orm::Result& r) {
                                Json::Value responseJson;
                                Json::Value messagesArray(Json::arrayValue);
                                for (const auto& row : r) {
                                    Json::Value messageJson;
                                    messageJson["id"] = row["id"].as<int>();
                                    messageJson["sender_id"] = row["sender_id"].as<int>();
                                    if (!row["content"].isNull()) {
                                        messageJson["content"] = row["content"].as<std::string>();
                                    }
                                    messageJson["message_type"] = row["message_type"].as<std::string>();
                                    if (!row["file_url"].isNull()) {
                                        messageJson["file_url"] = row["file_url"].as<std::string>();
                                    }
                                    if (!row["reply_to"].isNull()) {
                                        messageJson["reply_to"] = row["reply_to"].as<int>();
                                    }
                                    messageJson["created_at"] = row["created_at"].as<std::string>();
                                    if (!row["nickname"].isNull()) {
                                        messageJson["sender_nickname"] = row["nickname"].as<std::string>();
                                    }
                                    if (!row["avatar_url"].isNull()) {
                                        messageJson["sender_avatar"] = row["avatar_url"].as<std::string>();
                                    }
                                    messageJson["is_read"] = row["is_read"].as<bool>();

                                    messagesArray.append(messageJson);
                                }

                                responseJson["messages"] = messagesArray;
                                responseJson["has_more"] = (int)r.size() == pageSize;
                                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                            },
                            [=](const drogon::orm::DrogonDbException& e) {
                                ResponseUtils::sendError(*callbackPtr,
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                            },
                            roomIdParamStr, pageSizeParamStr, userIdParamStr, std::to_string(beforeId));
                } else {
                    // 偏移分页
                    int offset = (page - 1) * pageSize;
                    sql = "SELECT m.id, m.sender_id, m.content, m.message_type, m.file_url, m.reply_to, m.created_at, "
                          "       u.nickname, u.avatar_url, "
                          "       (SELECT COUNT(*) FROM chat_message_read WHERE message_id = m.id AND user_id = "
                          "$3::bigint) > "
                          "0 as is_read "
                          "FROM chat_message m "
                          "LEFT JOIN user_profile u ON m.sender_id = u.user_id "
                          "WHERE m.room_id = $1::bigint "
                          "ORDER BY m.created_at DESC "
                          "LIMIT $2::integer OFFSET $4::integer";

                    db->execSqlAsync(
                            sql,
                            [=](const drogon::orm::Result& r) {
                                Json::Value responseJson;
                                Json::Value messagesArray(Json::arrayValue);
                                for (const auto& row : r) {
                                    Json::Value messageJson;
                                    messageJson["id"] = row["id"].as<int>();
                                    messageJson["sender_id"] = row["sender_id"].as<int>();
                                    if (!row["content"].isNull()) {
                                        messageJson["content"] = row["content"].as<std::string>();
                                    }
                                    messageJson["message_type"] = row["message_type"].as<std::string>();
                                    if (!row["file_url"].isNull()) {
                                        messageJson["file_url"] = row["file_url"].as<std::string>();
                                    }
                                    if (!row["reply_to"].isNull()) {
                                        messageJson["reply_to"] = row["reply_to"].as<int>();
                                    }
                                    messageJson["created_at"] = row["created_at"].as<std::string>();
                                    if (!row["nickname"].isNull()) {
                                        messageJson["sender_nickname"] = row["nickname"].as<std::string>();
                                    }
                                    if (!row["avatar_url"].isNull()) {
                                        messageJson["sender_avatar"] = row["avatar_url"].as<std::string>();
                                    }
                                    messageJson["is_read"] = row["is_read"].as<bool>();

                                    messagesArray.append(messageJson);
                                }

                                responseJson["messages"] = messagesArray;
                                responseJson["has_more"] = (int)r.size() == pageSize;
                                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                            },
                            [=](const drogon::orm::DrogonDbException& e) {
                                ResponseUtils::sendError(*callbackPtr,
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                            },
                            roomIdParamStr, pageSizeParamStr, userIdParamStr, std::to_string(offset));
                }
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            roomIdStr, userIdStr);
}

void ChatController::sendMessage(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数(房间ID)
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Room ID is required", k400BadRequest);
        return;
    }
    std::string roomIdStr = routingParams[0];
    int roomId = std::stoi(roomIdStr);

    // 2. 获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    std::string content = json.get("content", "").asString();
    std::string messageType = json.get("message_type", "text").asString();
    std::string fileUrl = json.get("file_url", "").asString();
    int replyTo = json.get("reply_to", 0).asInt();

    if (content.empty() && fileUrl.empty()) {
        ResponseUtils::sendError(callback, "Content or file_url is required", k400BadRequest);
        return;
    }

    // 4. 验证用户是聊天室成员
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 准备参数字符串（确保所有参数都是明确的 std::string 类型）
    std::string contentStr = content.empty() ? "" : content;
    std::string fileUrlStr = fileUrl.empty() ? "" : fileUrl;
    std::string replyToStr = replyTo > 0 ? std::to_string(replyTo) : "";

    db->execSqlAsync(
            "SELECT id FROM chat_room_member WHERE room_id = $1::bigint AND user_id = $2::bigint",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "You are not a member of this room", k403Forbidden);
                    return;
                }

                // 5. 插入消息
                // 使用 COALESCE 处理可选字段，简化 SQL
                std::string sql =
                        "INSERT INTO chat_message (room_id, sender_id, content, message_type, file_url, reply_to, "
                        "created_at) "
                        "VALUES ($1::bigint, $2::bigint, $3, $4, NULLIF($5, ''), NULLIF($6, '')::bigint, NOW()) "
                        "RETURNING id, created_at";

                db->execSqlAsync(
                        sql,
                        [=](const drogon::orm::Result& r) {
                            if (r.empty()) {
                                ResponseUtils::sendError(*callbackPtr, "Failed to send message",
                                                         k500InternalServerError);
                                return;
                            }

                            int messageId = r[0]["id"].as<int>();
                            std::string createdAt = r[0]["created_at"].as<std::string>();

                            // 5. 创建未读记录（除了发送者）
                            db->execSqlAsync(
                                    "INSERT INTO chat_message_read (message_id, user_id, read_at) "
                                    "SELECT $1::bigint, user_id, NOW() FROM chat_room_member WHERE room_id = "
                                    "$2::bigint AND user_id != $3::bigint",
                                    [=](const drogon::orm::Result& r) {
                                        // 返回消息
                                        Json::Value responseJson;
                                        responseJson["id"] = messageId;
                                        responseJson["room_id"] = roomId;
                                        responseJson["sender_id"] = userId;
                                        if (!content.empty()) {
                                            responseJson["content"] = content;
                                        }
                                        responseJson["message_type"] = messageType;
                                        if (!fileUrl.empty()) {
                                            responseJson["file_url"] = fileUrl;
                                        }
                                        if (replyTo > 0) {
                                            responseJson["reply_to"] = replyTo;
                                        }
                                        responseJson["created_at"] = createdAt;
                                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                                    },
                                    [=](const drogon::orm::DrogonDbException& e) {
                                        // 即使未读记录创建失败，也返回消息（不影响主流程）
                                        Json::Value responseJson;
                                        responseJson["id"] = messageId;
                                        responseJson["room_id"] = roomId;
                                        responseJson["sender_id"] = userId;
                                        if (!content.empty()) {
                                            responseJson["content"] = content;
                                        }
                                        responseJson["message_type"] = messageType;
                                        responseJson["created_at"] = createdAt;
                                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                                    },
                                    std::to_string(messageId), roomIdStr, userIdStr);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        roomIdStr, userIdStr, contentStr, messageType, fileUrlStr, replyToStr);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(roomId), std::to_string(userId));
}

void ChatController::markMessageRead(const HttpRequestPtr& req,
                                     std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数(消息ID)
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Message ID is required", k400BadRequest);
        return;
    }
    std::string messageIdStr = routingParams[0];
    int messageId = std::stoi(messageIdStr);

    // 2. 获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 插入或更新已读记录
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "INSERT INTO chat_message_read (message_id, user_id, read_at) "
            "VALUES ($1, $2, NOW()) "
            "ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = NOW()",
            [=](const drogon::orm::Result&) {
                // 3. 更新聊天室成员的 last_read_at
                db->execSqlAsync(
                        "UPDATE chat_room_member SET last_read_at = NOW() "
                        "WHERE room_id = (SELECT room_id FROM chat_message WHERE id = $1) AND user_id = $2",
                        [=](const drogon::orm::Result&) {
                            Json::Value responseJson;
                            responseJson["message"] = "Message marked as read";
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException&) {
                            // 即使更新失败，也返回成功（已读记录已创建）
                            Json::Value responseJson;
                            responseJson["message"] = "Message marked as read";
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        std::to_string(messageId), std::to_string(userId));
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            messageIdStr, userIdStr);
}