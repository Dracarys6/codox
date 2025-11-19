#include "NotificationHub.h"

#include <json/writer.h>

#include <vector>

std::mutex NotificationHub::mutex_;
std::unordered_map<size_t, std::pair<int, NotificationHub::ConnectionWeakPtr>> NotificationHub::connections_;
std::unordered_map<int, std::unordered_set<size_t>> NotificationHub::userConnections_;
std::atomic_size_t NotificationHub::nextConnectionId_{1};

// 记录新连接并返回内部 ID。
size_t NotificationHub::registerConnection(int userId, const drogon::WebSocketConnectionPtr& conn) {
    size_t connectionId = nextConnectionId_.fetch_add(1);
    {
        std::lock_guard<std::mutex> lock(mutex_);
        connections_[connectionId] = {userId, conn};
        userConnections_[userId].insert(connectionId);
    }
    return connectionId;
}

// 从映射中移除连接（通常在 WS 关闭时调用）。
void NotificationHub::unregisterConnection(size_t connectionId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = connections_.find(connectionId);
    if (it == connections_.end()) {
        return;
    }
    int userId = it->second.first;
    connections_.erase(it);
    auto userIt = userConnections_.find(userId);
    if (userIt != userConnections_.end()) {
        userIt->second.erase(connectionId);
        if (userIt->second.empty()) {
            userConnections_.erase(userIt);
        }
    }
}

// 将通知推送给指定用户的所有在线连接。
void NotificationHub::pushNotification(int userId, const Json::Value& notification) {
    std::vector<drogon::WebSocketConnectionPtr> targets;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        pruneExpiredConnectionsLocked(userId);
        auto userIt = userConnections_.find(userId);
        if (userIt == userConnections_.end()) {
            return;
        }
        for (auto connectionId : userIt->second) {
            auto connIt = connections_.find(connectionId);
            if (connIt == connections_.end()) continue;
            if (auto conn = connIt->second.second.lock()) {
                targets.push_back(conn);
            }
        }
    }

    if (targets.empty()) return;

    Json::StreamWriterBuilder builder;
    Json::Value payload;
    payload["type"] = "notification";
    payload["data"] = notification;
    std::string message = Json::writeString(builder, payload);

    for (auto& conn : targets) {
        conn->send(message);
    }
}

// 清理 userId 相关的过期 weak_ptr，需在持锁状态下调用。
void NotificationHub::pruneExpiredConnectionsLocked(int userId) {
    auto userIt = userConnections_.find(userId);
    if (userIt == userConnections_.end()) return;

    std::vector<size_t> expiredIds;
    for (auto connectionId : userIt->second) {
        auto connIt = connections_.find(connectionId);
        if (connIt == connections_.end()) {
            expiredIds.push_back(connectionId);
            continue;
        }
        if (connIt->second.second.expired()) {
            expiredIds.push_back(connectionId);
        }
    }

    for (auto connectionId : expiredIds) {
        connections_.erase(connectionId);
        userIt->second.erase(connectionId);
    }

    if (userIt->second.empty()) {
        userConnections_.erase(userIt);
    }
}
