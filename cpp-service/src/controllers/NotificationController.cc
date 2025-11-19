#include "NotificationController.h"

#include <json/json.h>

#include <limits>
#include <memory>
#include <sstream>
#include <vector>

#include "../utils/ResponseUtils.h"

void NotificationController::getNotifications(const HttpRequestPtr& req,
                                              std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    int page = 1;
    int pageSize = 20;
    bool unreadOnly = false;

    // 通用的整数参数解析，保证边界合法。
    auto parseIntParam = [&](const std::string& name, int minValue, int maxValue, int defaultValue) {
        std::string value = req->getParameter(name);
        if (value.empty()) return defaultValue;
        try {
            int parsed = std::stoi(value);
            parsed = std::max(minValue, parsed);
            parsed = std::min(maxValue, parsed);
            return parsed;
    } catch (...) {
            return defaultValue;
        }
    };

    page = parseIntParam("page", 1, std::numeric_limits<int>::max(), page);
    // 支持 pageSize/page_size 两种命名
    std::string pageSizeParam = req->getParameter("page_size");
    if (pageSizeParam.empty()) {
        pageSizeParam = req->getParameter("pageSize");
    }
    if (!pageSizeParam.empty()) {
        try {
            pageSize = std::stoi(pageSizeParam);
            pageSize = std::max(1, std::min(100, pageSize));
    } catch (...) {
            pageSize = 20;
        }
    }

    std::string unreadOnlyStr = req->getParameter("unread_only");
    if (unreadOnlyStr.empty()) {
        unreadOnlyStr = req->getParameter("unreadOnly");
    }
    if (unreadOnlyStr == "true" || unreadOnlyStr == "1") {
        unreadOnly = true;
    }

    // 支持多种命名的筛选参数，方便前端渐进迁移。
    std::string typeFilter = req->getParameter("type");
    std::string docIdFilter = req->getParameter("doc_id");
    if (docIdFilter.empty()) {
        docIdFilter = req->getParameter("docId");
    }
    std::string startDate = req->getParameter("start_date");
    if (startDate.empty()) startDate = req->getParameter("startDate");
    std::string endDate = req->getParameter("end_date");
    if (endDate.empty()) endDate = req->getParameter("endDate");

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    int offset = (page - 1) * pageSize;

    std::string sql =
            "SELECT n.id, n.type, n.payload::text AS payload_text, n.is_read, n.created_at "
            "FROM notification n "
            "LEFT JOIN notification_setting ns ON ns.user_id = n.user_id AND ns.notification_type = n.type "
            "WHERE n.user_id = $1::bigint "
            "  AND ($2::boolean = FALSE OR n.is_read = FALSE) "
            "  AND ($3 = '' OR n.type = $3) "
            "  AND ($4 = '' OR (n.payload->>'doc_id') = $4) "
            "  AND ($5 = '' OR n.created_at >= $5::timestamptz) "
            "  AND ($6 = '' OR n.created_at <= $6::timestamptz) "
            "  AND COALESCE(ns.in_app_enabled, TRUE) = TRUE "
            "ORDER BY n.created_at DESC "
            "LIMIT $7::integer OFFSET $8::integer";

    db->execSqlAsync(
            sql,
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                Json::Value notificationsArray(Json::arrayValue);
                Json::CharReaderBuilder readerBuilder;

                for (const auto& row : r) {
                    Json::Value notificationJson;
                    notificationJson["id"] = row["id"].as<int>();
                    notificationJson["type"] = row["type"].as<std::string>();
                    notificationJson["is_read"] = row["is_read"].as<bool>();
                    notificationJson["created_at"] = row["created_at"].as<std::string>();

                    const std::string payloadText = row["payload_text"].as<std::string>();
                    if (!payloadText.empty()) {
                        Json::Value payloadJson;
                        JSONCPP_STRING errs;
                        std::unique_ptr<Json::CharReader> reader(readerBuilder.newCharReader());
                        if (reader->parse(payloadText.data(), payloadText.data() + payloadText.size(), &payloadJson,
                                          &errs)) {
                            notificationJson["payload"] = payloadJson;
                        } else {
                            notificationJson["payload_raw"] = payloadText;
                        }
                    }

                    notificationsArray.append(notificationJson);
                }

                responseJson["notifications"] = notificationsArray;
                responseJson["page"] = page;
                responseJson["page_size"] = pageSize;
                responseJson["filters"]["type"] = typeFilter;
                responseJson["filters"]["doc_id"] = docIdFilter;
                responseJson["filters"]["start_date"] = startDate;
                responseJson["filters"]["end_date"] = endDate;
                responseJson["filters"]["unread_only"] = unreadOnly;

                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, unreadOnly ? "true" : "false", typeFilter, docIdFilter, startDate, endDate,
            std::to_string(pageSize), std::to_string(offset));
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

    std::stringstream arrayBuilder;
    arrayBuilder << "{";
    for (size_t i = 0; i < notificationIds.size(); ++i) {
        if (i > 0) arrayBuilder << ",";
        arrayBuilder << notificationIds[i];
    }
    arrayBuilder << "}";

    db->execSqlAsync(
            "UPDATE notification SET is_read = TRUE "
            "WHERE user_id = $1::bigint AND id = ANY($2::bigint[])",
            [=](const drogon::orm::Result&) {
                Json::Value responseJson;
                responseJson["message"] = "Notifications marked as read";
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()));
            },
            userIdStr, arrayBuilder.str());
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
            "SELECT COUNT(*) as count "
            "FROM notification n "
            "LEFT JOIN notification_setting ns ON ns.user_id = n.user_id AND ns.notification_type = n.type "
            "WHERE n.user_id = $1::bigint AND n.is_read = FALSE AND COALESCE(ns.in_app_enabled, TRUE) = TRUE",
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