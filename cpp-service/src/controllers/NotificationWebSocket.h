#pragma once
#include <drogon/WebSocketController.h>
#include <drogon/drogon.h>

#include "../services/NotificationHub.h"
#include "../utils/JwtUtil.h"

/**
 * NotificationWebSocket 提供 `/ws/notifications` 实时通道，
 * 用于认证后的用户接收推送通知。
 */
class NotificationWebSocket : public drogon::WebSocketController<NotificationWebSocket> {
public:
    // 连接建立后，根据 filter 注入的 user_id 注册到 NotificationHub。
    void handleNewConnection(const drogon::HttpRequestPtr& req, const drogon::WebSocketConnectionPtr& conn) override;
    // WebSocket 关闭时撤销连接。
    void handleConnectionClosed(const drogon::WebSocketConnectionPtr& conn) override;
    // 目前仅处理 ping/pong，所有业务通知均来自服务端推送。
    void handleNewMessage(const drogon::WebSocketConnectionPtr& conn, std::string&& message,
                          const drogon::WebSocketMessageType& type) override;

    WS_PATH_LIST_BEGIN
    WS_PATH_ADD("/ws/notifications");
    WS_PATH_LIST_END
};
