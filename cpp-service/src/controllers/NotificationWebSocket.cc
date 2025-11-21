#include "NotificationWebSocket.h"

#include <json/writer.h>

namespace {
struct ConnectionContext {
    size_t connectionId{0};
    int userId{0};
};
}  // namespace

void NotificationWebSocket::handleNewConnection(const drogon::HttpRequestPtr& req,
                                                const drogon::WebSocketConnectionPtr& conn) {
    int userId = 0;
    std::string userIdStr = req->getParameter("user_id");

    if (!userIdStr.empty()) {
    try {
        userId = std::stoi(userIdStr);
    } catch (...) {
        conn->forceClose();
        return;
        }
    } else {
        // 尝试从 token 参数解析
        std::string token = req->getParameter("token");
        if (token.empty()) {
            conn->forceClose();
            return;
        }

        std::string secret = "default-secret";
        auto& config = drogon::app().getCustomConfig();
        if (!config.isNull()) {
            if (config.isMember("app") && config["app"].isMember("jwt_secret")) {
                secret = config["app"]["jwt_secret"].asString();
            } else if (config.isMember("jwt_secret")) {
                secret = config["jwt_secret"].asString();
            }
        }

        if (!JwtUtil::verifyToken(token, secret)) {
            conn->forceClose();
            return;
        }

        userId = JwtUtil::getUserIdFromToken(token);
        if (userId <= 0) {
            conn->forceClose();
            return;
        }
    }

    size_t connectionId = NotificationHub::registerConnection(userId, conn);
    auto ctx = std::make_shared<ConnectionContext>();
    ctx->connectionId = connectionId;
    ctx->userId = userId;
    conn->setContext(ctx);

    // 连接成功后给客户端一个简单确认消息，便于调试。
    Json::Value ack;
    ack["type"] = "notification_ack";
    ack["message"] = "notifications_connected";
    ack["connection_id"] = static_cast<Json::UInt64>(connectionId);
    Json::StreamWriterBuilder builder;
    conn->send(Json::writeString(builder, ack));
}

void NotificationWebSocket::handleConnectionClosed(const drogon::WebSocketConnectionPtr& conn) {
    auto ctx = conn->getContext<ConnectionContext>();
    if (ctx) {
        NotificationHub::unregisterConnection(ctx->connectionId);
    }
}

void NotificationWebSocket::handleNewMessage(const drogon::WebSocketConnectionPtr& conn, std::string&& message,
                                             const drogon::WebSocketMessageType& type) {
    // 目前通知通道仅用于服务端推送，客户端消息仅用于心跳
    if (type == drogon::WebSocketMessageType::Ping) {
        conn->send(std::move(message));
        return;
    }

    if (type == drogon::WebSocketMessageType::Text && message == "ping") {
        conn->send("pong");
    }
}
