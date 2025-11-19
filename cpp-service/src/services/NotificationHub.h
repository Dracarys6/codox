#pragma once
#include <drogon/WebSocketController.h>
#include <json/json.h>

#include <atomic>
#include <memory>
#include <mutex>
#include <unordered_map>
#include <unordered_set>

/**
 * NotificationHub 负责维护所有通知 WebSocket 连接，并提供推送接口。
 * 该类为纯静态实现，便于在任意业务代码中直接调用。
 */
class NotificationHub {
public:
    // 注册一个新的 WebSocket 连接，返回内部维护的连接 ID。
    static size_t registerConnection(int userId, const drogon::WebSocketConnectionPtr& conn);

    // 注销连接（在连接关闭或认证失败时调用）。
    static void unregisterConnection(size_t connectionId);

    // 向指定用户推送通知（如果存在 WebSocket 连接）。
    static void pushNotification(int userId, const Json::Value& notification);

private:
    // 清理已失效的连接，内部调用前需加锁。
    static void pruneExpiredConnectionsLocked(int userId);

    static std::mutex mutex_;  // 保护所有静态容器
    using ConnectionWeakPtr = std::weak_ptr<drogon::WebSocketConnection>;
    static std::unordered_map<size_t, std::pair<int, ConnectionWeakPtr>>
            connections_;                                                         // connectionId -> (userId, conn)
    static std::unordered_map<int, std::unordered_set<size_t>> userConnections_;  // userId -> connectionId set
    static std::atomic_size_t nextConnectionId_;                                  // 自增连接 ID
};
