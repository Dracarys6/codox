#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include "../middleware/JwtAuthFilter.h"

/**
 * NotificationSettingController 提供通知偏好 CRUD 接口，
 * 允许用户控制不同类型通知的推送方式。
 */
class NotificationSettingController : public drogon::HttpController<NotificationSettingController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(NotificationSettingController::getSettings, "/api/notification-settings", Get, "JwtAuthFilter");
    ADD_METHOD_TO(NotificationSettingController::upsertSetting, "/api/notification-settings/{type}", Put,
                  "JwtAuthFilter");
    ADD_METHOD_TO(NotificationSettingController::deleteSetting, "/api/notification-settings/{type}", Delete,
                  "JwtAuthFilter");
    METHOD_LIST_END

    void getSettings(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void upsertSetting(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void deleteSetting(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};

