#include "NotificationController.h"

#include <json/json.h>

#include <vector>

#include "../utils/ResponseUtils.h"

void NotificationController::getNotifications(const HttpRequestPtr& req,
                                              std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 2. 解析查询参数
    int page = 1;
    int pageSize = 20;
    bool unreadOnly = false;

    try {
        std::string pageStr = req->getParameter("page");
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {
    }

    try {
        std::string pageSizeStr = req->getParameter("page_size");
        if (!pageSizeStr.empty()) pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
    } catch (...) {
    }

    std::string unreadOnlyStr = req->getParameter("unread_only");
    if (unreadOnlyStr == "true" || unreadOnlyStr == "1") {
        unreadOnly = true;
    }

    // 3. 查询通知列表
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    std::string whereClause =
            unreadOnly ? "WHERE n.user_id = $1::integer AND n.is_read = FALSE" : "WHERE n.user_id = $1::integer";
    int offset = (page - 1) * pageSize;

    db->execSqlAsync(
            "SELECT n.id, n.type, n.payload, n.is_read, n.created_at "
            "FROM notification n " +
                    whereClause +
                    " "
                    "ORDER BY n.created_at DESC "
                    "LIMIT $" +
                    std::to_string(unreadOnly ? 2 : 2) + " OFFSET $" + std::to_string(unreadOnly ? 3 : 3),
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                Json::Value notificationsArray(Json::arrayValue);

                for (const auto& row : r) {
                    Json::Value notificationJson;
                    notificationJson["id"] = row["id"].as<int>();
                    notificationJson["type"] = row["type"].as<std::string>();
                    notificationJson["is_read"] = row["is_read"].as<bool>();
                    notificationJson["created_at"] = row["created_at"].as<std::string>();

                    // 解析 payload JSONB
                    if (!row["payload"].isNull()) {
                        notificationJson["payload"] = Json::Value(row["payload"].as<std::string>());
                    }

                    notificationsArray.append(notificationJson);
                }

                responseJson["notifications"] = notificationsArray;
                responseJson["page"] = page;
                responseJson["page_size"] = pageSize;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            std::to_string(userId), std::to_string(pageSize), std::to_string(offset));
}

void NotificationController::markAsRead(const HttpRequestPtr& req,
                                        std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    // 2.解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    // 3.获取通知 ID 列表
    if (!json.isMember("notification_ids") || !json["notification_ids"].isArray()) {
        ResponseUtils::sendError(callback, "Notification_ids array is required", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 4.批量标记为已读
    Json::Value idsArray = json["notification_ids"];
    std::vector<int> notificationIds;
    for (const auto& id : idsArray) {
        notificationIds.push_back(id.asInt());
    }

    if (notificationIds.empty()) {
        ResponseUtils::sendError(*callbackPtr, "notification_ids cannot be empty", k400BadRequest);
        return;
    }

    // 构建 SQL IN 子句
    std::string idsStr;
    for (size_t i = 0; i < notificationIds.size(); i++) {
        if (i > 0) idsStr += ',';
        idsStr += std::to_string(notificationIds[i]);
    }

    db->execSqlAsync(
            "UPDATE notification SET is_read =TRUE "
            "WHERE id IN (" +
                    idsStr + ") AND user_id =$1",
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                responseJson["message"] = "Notifications marked as read";
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()));
            },
            userIdStr);
}

void NotificationController::getUnreadCount(const HttpRequestPtr& req,
                                            std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.获取user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    // 2.查询未读通知数量
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    db->execSqlAsync(
            "SELECT COUNT(*) as count FROM notification WHERE user_id = $1 AND is_read = FALSE",
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                responseJson["unread_count"] = r[0]["count"].as<int>();
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr);
}