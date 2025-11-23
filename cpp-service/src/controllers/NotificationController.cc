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

    // 辅助函数：获取参数，如果 getParameter 获取不到，尝试从查询字符串手动解析
    auto getParam = [&](const std::string& name) -> std::string {
        std::string value = req->getParameter(name);
        if (!value.empty()) {
            return value;
        }
        // 如果 getParameter 获取不到，尝试从查询字符串手动解析
        std::string queryString = req->query();
        if (!queryString.empty()) {
            std::string searchKey = name + "=";
            size_t pos = queryString.find(searchKey);
            if (pos != std::string::npos) {
                size_t start = pos + searchKey.length();
                size_t end = queryString.find("&", start);
                if (end == std::string::npos) {
                    end = queryString.length();
                }
                value = queryString.substr(start, end - start);
                // URL 解码
                value = drogon::utils::urlDecode(value);
                return value;
            }
        }
        return "";
    };

    int page = 1;
    int pageSize = 20;
    bool unreadOnly = false;

    // 通用的整数参数解析，保证边界合法。
    auto parseIntParam = [&](const std::string& name, int minValue, int maxValue, int defaultValue) {
        std::string value = getParam(name);
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
    std::string pageSizeParam = getParam("page_size");
    if (pageSizeParam.empty()) {
        pageSizeParam = getParam("pageSize");
    }
    if (!pageSizeParam.empty()) {
        try {
            pageSize = std::stoi(pageSizeParam);
            pageSize = std::max(1, std::min(100, pageSize));
    } catch (...) {
            pageSize = 20;
        }
    }

    std::string unreadOnlyStr = getParam("unread_only");
    if (unreadOnlyStr.empty()) {
        unreadOnlyStr = getParam("unreadOnly");
    }
    if (unreadOnlyStr == "true" || unreadOnlyStr == "1") {
        unreadOnly = true;
    }

    // 支持多种命名的筛选参数，方便前端渐进迁移。
    std::string typeFilter = getParam("type");
    std::string docIdFilter = getParam("doc_id");
    if (docIdFilter.empty()) {
        docIdFilter = getParam("docId");
    }
    std::string startDate = getParam("start_date");
    if (startDate.empty()) startDate = getParam("startDate");
    std::string endDate = getParam("end_date");
    if (endDate.empty()) endDate = getParam("endDate");

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    int offset = (page - 1) * pageSize;

    std::string baseQuery =
            "FROM notification n "
            "WHERE n.user_id = $1::bigint "
            "  AND ($2::boolean = FALSE OR n.is_read = FALSE) "
            "  AND ($3 = '' OR n.type = $3) "
            "  AND ($4 = '' OR (n.payload->>'doc_id') = $4) "
            "  AND ($5 = '' OR n.created_at >= $5::timestamptz) "
            "  AND ($6 = '' OR n.created_at <= $6::timestamptz) ";

    std::string listSql = "SELECT n.id, n.type, n.payload::text AS payload_text, n.is_read, n.created_at " + baseQuery +
            "ORDER BY n.created_at DESC "
            "LIMIT $7::integer OFFSET $8::integer";

    std::string countSql = "SELECT COUNT(*) AS total " + baseQuery;

    db->execSqlAsync(
            listSql,
            [=](const drogon::orm::Result& r) {
                auto responseJson = std::make_shared<Json::Value>();
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

                (*responseJson)["notifications"] = notificationsArray;
                (*responseJson)["page"] = page;
                (*responseJson)["page_size"] = pageSize;
                (*responseJson)["filters"]["type"] = typeFilter;
                (*responseJson)["filters"]["doc_id"] = docIdFilter;
                (*responseJson)["filters"]["start_date"] = startDate;
                (*responseJson)["filters"]["end_date"] = endDate;
                (*responseJson)["filters"]["unread_only"] = unreadOnly;

                db->execSqlAsync(
                        countSql,
                        [=](const drogon::orm::Result& countResult) {
                            int total = 0;
                            if (!countResult.empty()) {
                                total = countResult[0]["total"].as<int>();
                            }
                            (*responseJson)["total"] = total;
                            ResponseUtils::sendSuccess(*callbackPtr, *responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        userIdStr, unreadOnly ? "true" : "false", typeFilter, docIdFilter, startDate, endDate);
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
            "FROM notification "
            "WHERE user_id = $1::bigint AND is_read = FALSE",
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