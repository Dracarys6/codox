#include "DocumentController.h"

#include <drogon/drogon.h>
#include <json/json.h>

#include <memory>
#include <vector>

#include "../utils/DbUtils.h"
#include "../utils/ResponseUtils.h"

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
                        docIdStr, userIdStr);  // 直接使用字符串
            },
            [=](const drogon::orm::DrogonDbException &e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, title);  // 直接使用 userIdStr
}

// 标签后续通过更新接口添加

void DocumentController::list(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    // 2.解析查询参数
    int page = 1;
    int pageSize = 20;

    try {
        std::string pageStr = req->getParameter("page");
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {
    }

    try {
        std::string pageSizeStr = req->getParameter("pageSize");
        if (!pageSizeStr.empty()) pageSize = std::min(100, std::max(1, std::stoi(pageSizeStr)));
    } catch (...) {
    }

    int offset = (page - 1) * pageSize;

    // 预先转换为字符串，避免在 lambda 中重复转换
    std::string pageSizeStr = std::to_string(pageSize);
    std::string offsetStr = std::to_string(offset);

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
                        userIdStr, pageSizeStr, offsetStr);  // 直接使用预转换的字符串
            },
            [=](const drogon::orm::DrogonDbException &e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr);
}

void DocumentController::getById(const HttpRequestPtr &req, std::function<void(const HttpResponsePtr &)> &&callback) {
    // 1.获取doc_id (路径参数)  /api/docs/{id}
    // 路径参数通过 getRoutingParameters() 获取，返回 vector
    auto routingParams = req->getRoutingParameters();
    std::string docIdStr;
    if (!routingParams.empty()) {
        docIdStr = routingParams[0];
    }
    if (docIdStr.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }

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