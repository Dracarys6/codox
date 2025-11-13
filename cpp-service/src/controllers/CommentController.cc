#include "CommentController.h"

#include <json/json.h>

#include "../utils/PermissionUtils.h"
#include "../utils/ResponseUtils.h"

void CommentController::getComments(const HttpRequestPtr& req,
                                    std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    int docId = std::stoi(docIdStr);

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3.检查权限
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4.查询评论列表(树形结构)
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }

        db->execSqlAsync(
                "SELECT c.id, c.doc_id , c.author_id, c.anchor, c.content, c.parent_id, c.created_at,"
                "u.email, up.nickname "
                "FROM comment c"
                "LEFT JOIN \"user\" u ON c.author_id = u.id "
                "LEFT JOIN user_profile up ON u.id = up.user_id "
                "WHERE c.doc_id = $1 "
                "ORDER BY c.created_at ASC",
                [=](const drogon::orm::Result& r) {
                    Json::Value responseJson;
                    Json::Value commentsArray(Json::arrayValue);

                    for (const auto& row : r) {
                        Json::Value commentJson;
                        commentJson["id"] = row["id"].as<int>();
                        commentJson["doc_id"] = row["doc_id"].as<int>();
                        commentJson["author_id"] = row["author_id"].as<int>();
                        commentJson["content"] = row["content"].as<std::string>();
                        commentJson["created_at"] = row["created_at"].as<std::string>();

                        // 解析 anchor JSONB
                        if (!row["anchor"].isNull()) {
                            commentJson["anchor"] = Json::Value(row["anchor"].as<std::string>());
                        }

                        // parent_id
                        if (!row["parent_id"].isNull()) {
                            commentJson["parent_id"] = row["parent_id"].as<int>();
                        }

                        // 作者信息
                        Json::Value authorJson;
                        authorJson["id"] = row["author_id"].as<int>();
                        authorJson["email"] = row["email"].as<std::string>();
                        if (!row["nickname"].isNull()) {
                            authorJson["nickname"] = row["nickname"].as<std::string>();
                        }
                        commentJson["author"] = authorJson;

                        commentsArray.append(commentJson);
                    }

                    responseJson["comments"] = commentsArray;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                    return;
                },
                docIdStr);
    });
}

void CommentController::createComments(const HttpRequestPtr& req,
                                       std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    std::string docIdStr = routingParams[0];
    int docId = std::stoi(docIdStr);

    // 2.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k400BadRequest);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3.检查权限 (viewer或更高)
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }

        // 4.解析请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
    });
}