#include "NotificationSettingController.h"

#include <json/json.h>

#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "../utils/ResponseUtils.h"

namespace {
// 允许自定义设置的通知类型列表。
const std::unordered_set<std::string> kSupportedNotificationTypes = {
        "comment", "task_assigned", "task_status_changed", "permission_changed", "mention", "system"};

bool isSupportedType(const std::string& type) {
    return kSupportedNotificationTypes.find(type) != kSupportedNotificationTypes.end();
}

// 统一的布尔值解析，兼容 true/"true"/1 等输入。
bool parseBool(const Json::Value& json, const std::string& key, bool defaultValue) {
    if (!json.isMember(key)) return defaultValue;
    if (json[key].isBool()) return json[key].asBool();
    if (json[key].isString()) {
        std::string value = json[key].asString();
        std::transform(value.begin(), value.end(), value.begin(), ::tolower);
        return value == "true" || value == "1";
    }
    return defaultValue;
}

std::vector<std::string> supportedTypesInOrder() {
    return {"comment", "task_assigned", "task_status_changed", "permission_changed", "mention", "system"};
}
}  // namespace

void NotificationSettingController::getSettings(const HttpRequestPtr& req,
                                                std::function<void(const HttpResponsePtr&)>&& callback) {
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT notification_type, email_enabled, push_enabled, in_app_enabled "
            "FROM notification_setting WHERE user_id = $1::bigint",
            [=](const drogon::orm::Result& r) {
                std::unordered_map<std::string, Json::Value> overrides;
                for (const auto& row : r) {
                    Json::Value item;
                    item["type"] = row["notification_type"].as<std::string>();
                    item["email_enabled"] = row["email_enabled"].as<bool>();
                    item["push_enabled"] = row["push_enabled"].as<bool>();
                    item["in_app_enabled"] = row["in_app_enabled"].as<bool>();
                    overrides[item["type"].asString()] = item;
                }

                Json::Value settings(Json::arrayValue);
                for (const auto& type : supportedTypesInOrder()) {
                    if (overrides.find(type) != overrides.end()) {
                        settings.append(overrides[type]);
                    } else {
                        Json::Value item;
                        item["type"] = type;
                        item["email_enabled"] = true;
                        item["push_enabled"] = true;
                        item["in_app_enabled"] = true;
                        settings.append(item);
                    }
                }

                Json::Value responseJson;
                responseJson["settings"] = settings;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr);
}

void NotificationSettingController::upsertSetting(const HttpRequestPtr& req,
                                                  std::function<void(const HttpResponsePtr&)>&& callback) {
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Notification type is required", k400BadRequest);
        return;
    }
    std::string type = routingParams[0];
    std::transform(type.begin(), type.end(), type.begin(), ::tolower);
    if (!isSupportedType(type)) {
        ResponseUtils::sendError(callback, "Unsupported notification type", k400BadRequest);
        return;
    }

    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    bool emailEnabled = parseBool(json, "email_enabled", true);
    bool pushEnabled = parseBool(json, "push_enabled", true);
    bool inAppEnabled = parseBool(json, "in_app_enabled", true);

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "INSERT INTO notification_setting (user_id, notification_type, email_enabled, push_enabled, "
            "in_app_enabled) "
            "VALUES ($1::bigint, $2, $3::boolean, $4::boolean, $5::boolean) "
            "ON CONFLICT (user_id, notification_type) DO UPDATE "
            "SET email_enabled = EXCLUDED.email_enabled, "
            "    push_enabled = EXCLUDED.push_enabled, "
            "    in_app_enabled = EXCLUDED.in_app_enabled, "
            "    updated_at = NOW() "
            "RETURNING notification_type, email_enabled, push_enabled, in_app_enabled",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Failed to update setting", k500InternalServerError);
                    return;
                }
                Json::Value item;
                item["type"] = r[0]["notification_type"].as<std::string>();
                item["email_enabled"] = r[0]["email_enabled"].as<bool>();
                item["push_enabled"] = r[0]["push_enabled"].as<bool>();
                item["in_app_enabled"] = r[0]["in_app_enabled"].as<bool>();

                Json::Value responseJson;
                responseJson["setting"] = item;
                responseJson["message"] = "Notification setting updated";
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, type, emailEnabled ? "true" : "false", pushEnabled ? "true" : "false",
            inAppEnabled ? "true" : "false");
}

void NotificationSettingController::deleteSetting(const HttpRequestPtr& req,
                                                  std::function<void(const HttpResponsePtr&)>&& callback) {
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Notification type is required", k400BadRequest);
        return;
    }
    std::string type = routingParams[0];
    std::transform(type.begin(), type.end(), type.begin(), ::tolower);
    if (!isSupportedType(type)) {
        ResponseUtils::sendError(callback, "Unsupported notification type", k400BadRequest);
        return;
    }

    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    db->execSqlAsync(
            "DELETE FROM notification_setting WHERE user_id = $1::bigint AND notification_type = $2 "
            "RETURNING notification_type",
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                if (r.empty()) {
                    responseJson["message"] = "No setting to delete";
                } else {
                    responseJson["message"] = "Notification setting removed";
                    responseJson["type"] = r[0]["notification_type"].as<std::string>();
                }
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            userIdStr, type);
}
