#include "DocumentController.h"

#include <drogon/drogon.h>
#include <json/json.h>

#include <limits>
#include <memory>
#include <numeric>
#include <sstream>
#include <vector>

#include "../utils/DbUtils.h"
#include "../utils/PermissionUtils.h"
#include "../utils/ResponseUtils.h"

static void queryDocumentWithTags(const drogon::orm::DbClientPtr &db, int docId,
                                  std::shared_ptr<std::function<void(const HttpResponsePtr &)>> callbackPtr);
static void queryAclAndRespond(const drogon::orm::DbClientPtr &db, int docId, int ownerId,
                               std::shared_ptr<std::function<void(const HttpResponsePtr &)>> callbackPtr);
// 辅助函数：构建文档响应
static void buildDocumentResponse(const drogon::orm::Result &r,
                                  std::shared_ptr<std::function<void(const HttpResponsePtr &)>> callbackPtr) {
    Json::Value responseJson;
    responseJson["id"] = r[0]["id"].as<int>();
    responseJson["title"] = r[0]["title"].as<std::string>();
    responseJson["owner_id"] = r[0]["owner_id"].as<int>();
    responseJson["is_locked"] = r[0]["is_locked"].as<bool>();

    if (!r[0]["last_published_version_id"].isNull()) {
        responseJson["last_published_version_id"] = r[0]["last_published_version_id"].as<int>();
    }

    responseJson["created_at"] = r[0]["created_at"].as<std::string>();
    responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();

    // 解析标签 JSON
    std::string tagsJsonStr = r[0]["tags"].as<std::string>();
    Json::Reader reader;
    Json::Value tagsJson;
    if (reader.parse(tagsJsonStr, tagsJson) && tagsJson.isArray()) {
        responseJson["tags"] = tagsJson;
    } else {
        responseJson["tags"] = Json::Value(Json::arrayValue);
    }

    ResponseUtils::sendSuccess(*callbackPtr, responseJson);
}

// 辅助函数:处理标签更新
static void handleUpdateTags(const drogon::orm::DbClientPtr &db, int docId, const Json::Value &json,
                             const drogon::orm::Result &docResult,
                             std::shared_ptr<std::function<void(const drogon::HttpResponsePtr &)>> callbackPtr) {
    // 没有标签更新,直接查询文档（包括标签）并返回
    if (!json.isMember("tags")) {
        queryDocumentWithTags(db, docId, callbackPtr);
        return;
    }

    std::string docIdStr = std::to_string(docId);

    // 删除旧标签关联
    db->execSqlAsync(
            "DELETE FROM doc_tag WHERE doc_id = $1::integer",
            [=](const drogon::orm::Result &r) {
                Json::Value tagsJson = json["tags"];
                if (!tagsJson.isArray() || tagsJson.size() == 0) {
                    // 没有新标签,查询文档（包括标签）并返回
                    queryDocumentWithTags(db, docId, callbackPtr);
                    return;
                }

                // 处理新标签,逐个插入
                // 使用shared_ptr确保所有lambda共享同一个状态
                struct TagUpdaterState {
                    drogon::orm::DbClientPtr db;
                    int docId;
                    Json::Value tagsJson;
                    std::shared_ptr<std::function<void(const HttpResponsePtr &)>> callbackPtr;
                    int index = 0;
                };

                auto state = std::make_shared<TagUpdaterState>(TagUpdaterState{db, docId, tagsJson, callbackPtr});

                // 定义递归处理函数（使用shared_ptr包装function以支持递归）
                auto processNext = std::make_shared<std::function<void()>>();
                *processNext = [=]() mutable {
                    if (state->index >= int(state->tagsJson.size())) {
                        // 所有标签处理完成,查询文档（包括标签）并返回响应
                        queryDocumentWithTags(state->db, state->docId, state->callbackPtr);
                        return;
                    }
                    std::string tagName = state->tagsJson[state->index].asString();
                    state->index++;

                    // 查找或创建标签
                    state->db->execSqlAsync(
                            "INSERT INTO tag (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 "
                            "RETURNING id, name",
                            [=](const drogon::orm::Result &tagResult) mutable {
                                if (!tagResult.empty()) {
                                    int tagId = tagResult[0]["id"].as<int>();

                                    // 关联文档和标签
                                    state->db->execSqlAsync(
                                            "INSERT INTO doc_tag (doc_id, tag_id) VALUES ($1::integer, "
                                            "$2::integer) ON CONFLICT DO NOTHING",
                                            [=](const drogon::orm::Result &r) mutable { (*processNext)(); },
                                            [=](const drogon::orm::DrogonDbException &e) {
                                                ResponseUtils::sendError(
                                                        *(state->callbackPtr),
                                                        "Database error: " + std::string(e.base().what()),
                                                        k500InternalServerError);
                                                return;
                                            },
                                            std::to_string(state->docId), std::to_string(tagId));
                                } else {
                                    (*processNext)();
                                }
                            },
                            [=](const drogon::orm::DrogonDbException &e) {
                                ResponseUtils::sendError(*(state->callbackPtr),
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                                return;
                            },
                            tagName);
                };

                // 开始处理
                (*processNext)();
            },
            [=](const drogon::orm::DrogonDbException &e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
                return;
            },
            docIdStr);
}

// 辅助函数：查询文档（包括标签）并返回响应
static void queryDocumentWithTags(const drogon::orm::DbClientPtr &db, int docId,
                                  std::shared_ptr<std::function<void(const HttpResponsePtr &)>> callbackPtr) {
    std::string docIdStr = std::to_string(docId);
    db->execSqlAsync(
            "SELECT d.id, d.title, d.owner_id, d.is_locked, d.last_published_version_id, "
            "       d.created_at, d.updated_at, "
            "       COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) "
            "                FILTER (WHERE t.id IS NOT NULL), '[]'::json) as tags "
            "FROM document d "
            "LEFT JOIN doc_tag dt ON d.id = dt.doc_id "
            "LEFT JOIN tag t ON dt.tag_id = t.id "
            "WHERE d.id = $1::integer "
            "GROUP BY d.id",
            [=](const drogon::orm::Result &r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                    return;
                }
                buildDocumentResponse(r, callbackPtr);
            },
            [=](const drogon::orm::DrogonDbException &e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            docIdStr);
}

// 辅助函数：查询 ACL 列表并返回统一响应
static void queryAclAndRespond(const drogon::orm::DbClientPtr &db, int docId, int ownerId,
                               std::shared_ptr<std::function<void(const HttpResponsePtr &)>> callbackPtr) {
    if (!db) {
        ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
        return;
    }
    std::string docIdStr = std::to_string(docId);
    std::string ownerIdStr = std::to_string(ownerId);

    db->execSqlAsync(
            "SELECT da.user_id, da.permission, u.email, up.nickname "
            "FROM doc_acl da "
            "INNER JOIN \"user\" u ON da.user_id = u.id "
            "LEFT JOIN user_profile up ON u.id = up.user_id "
            "WHERE da.doc_id = $1::bigint "
            "ORDER BY da.user_id",
            [=](const drogon::orm::Result &aclResult) {
                Json::Value aclArray(Json::arrayValue);
                bool ownerIncluded = false;

                for (const auto &row : aclResult) {
                    Json::Value aclItem;
                    int aclUserId = row["user_id"].as<int>();
                    aclItem["user_id"] = aclUserId;
                    aclItem["permission"] = row["permission"].as<std::string>();
                    aclItem["email"] = row["email"].as<std::string>();
                    if (!row["nickname"].isNull()) {
                        aclItem["nickname"] = row["nickname"].as<std::string>();
                    }
                    if (aclUserId == ownerId && aclItem["permission"].asString() == "owner") {
                        ownerIncluded = true;
                    }
                    aclArray.append(aclItem);
                }

                auto sendSuccessResponse = [callbackPtr, docId](const Json::Value &finalAcl) {
                    Json::Value responseJson;
                    responseJson["doc_id"] = docId;
                    responseJson["acl"] = finalAcl;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                };

                if (ownerIncluded) {
                    sendSuccessResponse(aclArray);
                    return;
                }

                // 如果结果中缺少 owner 记录（理论上不应该发生），补充一条
                db->execSqlAsync(
                        "SELECT u.email, up.nickname FROM \"user\" u "
                        "LEFT JOIN user_profile up ON u.id = up.user_id "
                        "WHERE u.id = $1::bigint",
                        [=](const drogon::orm::Result &ownerResult) mutable {
                            Json::Value ownerItem;
                            ownerItem["user_id"] = ownerId;
                            ownerItem["permission"] = "owner";
                            if (!ownerResult.empty()) {
                                ownerItem["email"] = ownerResult[0]["email"].as<std::string>();
                                if (!ownerResult[0]["nickname"].isNull()) {
                                    ownerItem["nickname"] = ownerResult[0]["nickname"].as<std::string>();
                                }
                            }
                            aclArray.append(ownerItem);
                            sendSuccessResponse(aclArray);
                        },
                        [=](const drogon::orm::DrogonDbException &e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        ownerIdStr);
            },
            [=](const drogon::orm::DrogonDbException &e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            docIdStr);
}

void DocumentController::create(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    // 验证 userId 是否为有效数字
    try {
        std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 2.解析 JSON 请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    std::string title = json.get("title", "").asString();

    // 3.验证标题
    if (title.empty()) {
        ResponseUtils::sendError(callback, "Title is required", k400BadRequest);
        return;
    }
    if (title.size() > 255) {
        ResponseUtils::sendError(callback, "Title too long", k400BadRequest);
        return;
    }

    // 4.获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    // 使用 shared_ptr 包装 callback 以支持嵌套异步调用
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr &)>>(std::move(callback));

    // 5.插入文档
    db->execSqlAsync(
            "INSERT INTO document (owner_id, title) VALUES ($1::integer, $2) "
            "RETURNING id, owner_id, title, is_locked, created_at, updated_at",
            [=](const drogon::orm::Result &r) mutable {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Failed to create document", k500InternalServerError);
                    return;
                }

                int docId = r[0]["id"].as<int>();
                std::string docIdStr = std::to_string(docId);  // 保存字符串版本，避免重复转换

                // 6.插入 owner ACL 记录
                db->execSqlAsync(
                        "INSERT INTO doc_acl (doc_id, user_id, permission) "
                        "VALUES($1::integer, $2::integer, 'owner') ON CONFLICT DO NOTHING",
                        [=](const drogon::orm::Result &) mutable {
                            Json::Value responseJson;
                            responseJson["id"] = docId;
                            responseJson["title"] = r[0]["title"].as<std::string>();
                            responseJson["owner_id"] = r[0]["owner_id"].as<int>();
                            responseJson["is_locked"] = r[0]["is_locked"].as<bool>();
                            responseJson["tags"] = Json::Value(Json::arrayValue);
                            responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                            responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                        },
                        [=](const drogon::orm::DrogonDbException &e) mutable {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        docIdStr, userIdStr);
            },
            [=](const drogon::orm::DrogonDbException &e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, title);
}

void DocumentController::list(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    // 2.解析查询参数
    // 通用的整数参数解析，保证边界合法
    auto parseIntParam = [&](const std::string &name, int minValue, int maxValue, int defaultValue) {
        std::string value = req->getParameter(name);
        if (value.empty()) return defaultValue;
        try {
            int parsed = std::stoi(value);
            return std::max(minValue, std::min(maxValue, parsed));
        } catch (...) {
            return defaultValue;
        }
    };

    int page = parseIntParam("page", 1, std::numeric_limits<int>::max(), 1);
    int pageSize = parseIntParam("pageSize", 1, 100, 20);
    int offset = (page - 1) * pageSize;

    // 3.查询文档
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr &)>>(std::move(callback));

    // 查询总和和列表(使用UNION简化)
    db->execSqlAsync(
            "SELECT COUNT(DISTINCT d.id) as total "
            "FROM document d "
            "LEFT JOIN doc_acl a ON d.id = a.doc_id "
            "WHERE d.owner_id = $1::integer OR a.user_id = $1::integer",
            [=](const drogon::orm::Result &countResult) mutable {
                int total = countResult.empty() ? 0 : countResult[0]["total"].as<int>();
                db->execSqlAsync(
                        "SELECT DISTINCT d.id, d.title, d.owner_id, d.is_locked, d.created_at, d.updated_at "
                        "FROM document d "
                        "LEFT JOIN doc_acl a ON d.id = a.doc_id "
                        "WHERE d.owner_id = $1::integer OR a.user_id = $1::integer "
                        "ORDER BY d.updated_at DESC "
                        "LIMIT $2::integer OFFSET $3::integer",
                        [=](const drogon::orm::Result &listResult) mutable {
                            Json::Value responseJson;
                            Json::Value docsArray(Json::arrayValue);
                            for (const auto &row : listResult) {
                                Json::Value docJson;
                                docJson["id"] = row["id"].as<int>();
                                docJson["title"] = row["title"].as<std::string>();
                                docJson["owner_id"] = row["owner_id"].as<int>();
                                docJson["is_locked"] = row["is_locked"].as<bool>();
                                docJson["created_at"] = row["created_at"].as<std::string>();
                                docJson["updated_at"] = row["updated_at"].as<std::string>();
                                docsArray.append(docJson);
                            }

                            responseJson["docs"] = docsArray;
                            responseJson["total"] = total;
                            responseJson["page"] = page;
                            responseJson["pageSize"] = pageSize;

                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException &e) mutable {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        userIdStr, std::to_string(pageSize), std::to_string(offset));
            },
            [=](const drogon::orm::DrogonDbException &e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr);
}

void DocumentController::get(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取doc_id (路径参数)  /api/docs/{id}
    // 路径参数通过 getRoutingParameters() 获取，返回 vector
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    // 验证 docId 是否为有效数字
    try {
        std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    // 验证 userId 是否为有效数字（用于后续比较）
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.查询文档详情
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr &)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT d.id, d.title, d.owner_id, d.is_locked, d.last_published_version_id, "
            "       d.created_at, d.updated_at, "
            "       COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) "
            "                FILTER (WHERE t.id IS NOT NULL), '[]'::json) as tags "
            "FROM document d "
            "LEFT JOIN doc_tag dt ON d.id = dt.doc_id "
            "LEFT JOIN tag t ON dt.tag_id = t.id "
            "WHERE d.id = $1::integer "
            "GROUP BY d.id",
            [=](const drogon::orm::Result &r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                    return;
                }

                // 检查权限（简单检查：owner 或 ACL 中存在）
                int ownerId = r[0]["owner_id"].as<int>();
                if (ownerId != userId) {
                    // 检查 ACL
                    db->execSqlAsync(
                            "SELECT 1 FROM doc_acl WHERE doc_id = $1::integer AND user_id = $2::integer",
                            [=](const drogon::orm::Result &aclResult) {
                                if (aclResult.empty()) {
                                    ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                                    return;
                                }
                                buildDocumentResponse(r, callbackPtr);
                            },
                            [=](const drogon::orm::DrogonDbException &e) {
                                ResponseUtils::sendError(*callbackPtr,
                                                         "Database error: " + std::string(e.base().what()),
                                                         k500InternalServerError);
                            },
                            docIdStr, userIdStr);
                } else {
                    buildDocumentResponse(r, callbackPtr);
                }
            },
            [=](const drogon::orm::DrogonDbException &e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            docIdStr);
}

void DocumentController::update(const drogon::HttpRequestPtr &req,
                                std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取doc_id (路径参数)  /api/docs/{id}
    // 路径参数通过 getRoutingParameters() 获取，返回 vector
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];

    // 验证 docId 是否为有效数字
    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    // 验证 userId 是否为有效数字
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.检查权限(必须是 owner 或 editor)
    auto callbackPtr = std::make_shared<std::function<void(const drogon::HttpResponsePtr &)>>(std::move(callback));

    PermissionUtils::hasPermission(docId, userId, "editor", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4.解析JSON请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;

        // 5.检查要更新的字段
        bool hasTitle = json.isMember("title");
        bool hasIsLocked = json.isMember("is_locked");
        bool hasTags = json.isMember("tags");

        if (!hasTitle && !hasIsLocked && !hasTags) {
            ResponseUtils::sendError(*callbackPtr, "No fields to update", k400BadRequest);
            return;
        }

        // 6.验证和提取字段值
        std::string title;
        bool isLocked = false;

        if (hasTitle) {
            title = json["title"].asString();
            if (title.length() > 255) {
                ResponseUtils::sendError(*callbackPtr, "Title too long", k400BadRequest);
                return;
            }
        }
        if (hasIsLocked) {
            isLocked = json["is_locked"].asBool();
        }

        // 7.获取数据库客户端
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        // 如果只更新tags，不需要更新document表，直接处理标签
        if (!hasTitle && !hasIsLocked && hasTags) {
            // 先查询文档是否存在
            db->execSqlAsync(
                    "SELECT * FROM document WHERE id = $1::integer",
                    [=](const drogon::orm::Result &r) {
                        if (r.empty()) {
                            ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                            return;
                        }
                        handleUpdateTags(db, docId, json, r, callbackPtr);
                    },
                    [=](const drogon::orm::DrogonDbException &e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                 k500InternalServerError);
                    },
                    std::to_string(docId));
            return;
        }

        // 8.构造SQL和参数（更新title或is_locked）
        std::string sql;
        std::string docIdStr = std::to_string(docId);
        std::string isLockedStr = isLocked ? "true" : "false";

        // 定义统一的成功和错误回调
        auto successCallback = [=](const drogon::orm::Result &r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                return;
            }
            handleUpdateTags(db, docId, json, r, callbackPtr);
        };

        auto errorCallback = [=](const drogon::orm::DrogonDbException &e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        // 9.执行更新（根据字段组合调用不同的重载）
        if (hasTitle && hasIsLocked) {
            // 更新 title 和 is_locked
            sql = "UPDATE document SET title = $1, is_locked = $2, updated_at = NOW() WHERE id = $3::integer RETURNING "
                  "*";
            db->execSqlAsync(sql, successCallback, errorCallback, title, isLockedStr, docIdStr);
        } else if (hasTitle) {
            // 只更新 title
            sql = "UPDATE document SET title = $1, updated_at = NOW() WHERE id = $2::integer RETURNING *";
            db->execSqlAsync(sql, successCallback, errorCallback, title, docIdStr);
        } else {
            // 只更新 is_locked
            sql = "UPDATE document SET is_locked = $1, updated_at = NOW() WHERE id = $2::integer RETURNING *";
            db->execSqlAsync(sql, successCallback, errorCallback, isLockedStr, docIdStr);
        }
    });
}

void DocumentController::deleteDoc(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取路径参数 {id}
    std::vector<std::string> routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }

    std::string docIdStr = routingParams[0];

    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    // 验证 userId 是否为有效数字
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.检查权限(必须是owner)
    auto callbackPtr = std::make_shared<std::function<void(const drogon::HttpResponsePtr &)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden: Only owner can delete document", k403Forbidden);
            return;
        }

        // 4.删除文档
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }
        db->execSqlAsync(
                "DELETE FROM document WHERE id = $1::integer AND owner_id = $2::integer",
                [=](const drogon::orm::Result &r) {
                    // 检查是否真的删除了文档
                    if (r.affectedRows() == 0) {
                        ResponseUtils::sendError(*callbackPtr, "Document not found or you are not the owner",
                                                 k404NotFound);
                        return;
                    }
                    // 返回成功删除的响应
                    Json::Value responseJson;
                    responseJson["message"] = "Document deleted successfully";
                    responseJson["id"] = docId;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException &e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                docIdStr, userIdStr);
    });
}

void DocumentController::getAcl(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取路径参数 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId;
    try {
        docId = std::stoi(routingParams[0]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr &)>>(std::move(callback));

    // 3.验证用户是文档owner
    PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Only document owner can view ACL", k403Forbidden);
            return;
        }
        queryAclAndRespond(db, docId, userId, callbackPtr);
    });
}

void DocumentController::updateAcl(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId;
    try {
        docId = std::stoi(routingParams[0]);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }
    std::string docIdStr = std::to_string(docId);

    // 2.获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 3.解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    if (!json.isMember("acl") || !json["acl"].isArray()) {
        ResponseUtils::sendError(callback, "acl array is required", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr &)>>(std::move(callback));

    // 4.验证当前用户是 owner
    PermissionUtils::hasPermission(docId, userId, "owner", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Only document owner can update ACL", k403Forbidden);
            return;
        }

        Json::Value aclArray = json["acl"];
        std::vector<std::pair<int, std::string>> aclItems;
        aclItems.reserve(aclArray.size());

        for (const auto &item : aclArray) {
            if (!item.isMember("user_id") || !item.isMember("permission")) {
                ResponseUtils::sendError(*callbackPtr, "Invalid ACL item: user_id and permission are required",
                                         k400BadRequest);
                return;
            }
            int aclUserId;
            try {
                aclUserId = item["user_id"].asInt();
            } catch (...) {
                ResponseUtils::sendError(*callbackPtr, "Invalid user_id in ACL item", k400BadRequest);
                return;
            }
            if (aclUserId == userId) {
                ResponseUtils::sendError(*callbackPtr, "Owner permission cannot be modified", k400BadRequest);
                return;
            }
            std::string permission = item["permission"].asString();
            if (permission != "viewer" && permission != "editor") {
                ResponseUtils::sendError(*callbackPtr, "Invalid permission: must be 'viewer' or 'editor'",
                                         k400BadRequest);
                return;
            }
            aclItems.emplace_back(aclUserId, permission);
        }

        auto errorHandler = [=](const drogon::orm::DrogonDbException &e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        };

        auto fetchAcl = [=]() { queryAclAndRespond(db, docId, userId, callbackPtr); };

        // 删除旧的 ACL（保留 owner）
        db->execSqlAsync(
                "DELETE FROM doc_acl WHERE doc_id = $1::bigint AND permission != 'owner'",
                [=](const drogon::orm::Result &) {
                    if (aclItems.empty()) {
                        fetchAcl();
                        return;
                    }

                    auto buildIntArray = [](const std::vector<std::pair<int, std::string>> &items) {
                        std::ostringstream oss;
                        oss << "{";
                        for (size_t i = 0; i < items.size(); ++i) {
                            if (i > 0) {
                                oss << ",";
                            }
                            oss << items[i].first;
                        }
                        oss << "}";
                        return oss.str();
                    };

                    auto buildTextArray = [](const std::vector<std::pair<int, std::string>> &items) {
                        std::ostringstream oss;
                        oss << "{";
                        for (size_t i = 0; i < items.size(); ++i) {
                            if (i > 0) {
                                oss << ",";
                            }
                            oss << "\"" << items[i].second << "\"";
                        }
                        oss << "}";
                        return oss.str();
                    };

                    std::string userIdArray = buildIntArray(aclItems);
                    std::string permissionArray = buildTextArray(aclItems);

                    db->execSqlAsync(
                            "INSERT INTO doc_acl (doc_id, user_id, permission) "
                            "SELECT $1::bigint, unnest($2::bigint[]), unnest($3::varchar[])",
                            [=](const drogon::orm::Result &) { fetchAcl(); }, errorHandler, docIdStr, userIdArray,
                            permissionArray);
                },
                errorHandler, docIdStr);
    });
}