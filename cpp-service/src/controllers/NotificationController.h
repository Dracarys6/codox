#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>

using namespace drogon;

class NotificationController : public drogon::HttpController<NotificationController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(NotificationController::getNotifications, "/api/notifications", Get, "JwtAuthFilter");
    ADD_METHOD_TO(NotificationController::markAsRead, "/api/notifications/read", Post, "JwtAuthFilter");
    ADD_METHOD_TO(NotificationController::getUnreadCount, "/api/notifications/unread-count", Get, "JwtAuthFilter");
    METHOD_LIST_END

    // 获取通知
    void getNotifications(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 标记为已读
    void markAsRead(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

    // 获取未读通知数量
    void getUnreadCount(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};