#include "NotificationUtils.h"

#include <drogon/drogon.h>
#include <json/json.h>

#include <memory>

#include "../services/NotificationHub.h"

void NotificationUtils::createCommentNotification(int docId, int commentId, int authorId, int targetUserId) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["comment_id"] = commentId;
    payload["author_id"] = authorId;

    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);

    auto db = drogon::app().getDbClient();
    if (!db) return;

    // 获取文档的所有者和其他有权限的用户（排除评论作者）
    db->execSqlAsync(
            "SELECT DISTINCT da.user_id "
            "FROM doc_acl da "
            "WHERE da.doc_id = $1::integer AND da.user_id != $2::integer",
            [=](const drogon::orm::Result& r) {
                for (const auto& row : r) {
                    int userId = row["user_id"].as<int>();
                    insertNotification(userId, "comment", payload);
                }
            },
            [](const drogon::orm::DrogonDbException&) {}, std::to_string(docId), std::to_string(authorId));
}

void NotificationUtils::createTaskAssignmentNotification(int docId, int taskId, int assigneeId) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["task_id"] = taskId;

    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);

    insertNotification(assigneeId, "task_assigned", payload);
}

void NotificationUtils::createTaskStatusNotification(int docId, int taskId, int assigneeId, const std::string& status) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["task_id"] = taskId;
    payload["status"] = status;

    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);

    // 通知任务创建者
    auto db = drogon::app().getDbClient();
    if (!db) return;

    db->execSqlAsync(
            "SELECT created_by FROM task WHERE id = $1::integer",
            [=](const drogon::orm::Result& r) {
                if (!r.empty()) {
                    int createdBy = r[0]["created_by"].as<int>();
                    if (createdBy != assigneeId) {
                        insertNotification(createdBy, "task_status_changed", payload);
                    }
                }
            },
            [](const drogon::orm::DrogonDbException&) {}, std::to_string(taskId));
}

void NotificationUtils::createPermissionChangeNotification(int docId, int userId, const std::string& permission) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["permission"] = permission;

    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);

    insertNotification(userId, "permission_changed", payload);
}

// 根据用户偏好写入通知并触发实时推送。
void NotificationUtils::insertNotification(int userId, const std::string& type, const Json::Value& payload) {
    auto db = drogon::app().getDbClient();
    if (!db) return;
    auto dbClient = db;

    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);
    std::string userIdStr = std::to_string(userId);

    auto insertAndPush = [=](bool inAppEnabled) {
        if (!inAppEnabled) {
            return;
        }
        dbClient->execSqlAsync(
                "INSERT INTO notification (user_id, type, payload) VALUES ($1::bigint, $2, $3::jsonb) "
                "RETURNING id, user_id, type, payload, is_read, created_at",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        return;
                    }
                    Json::Value notificationJson;
                    notificationJson["id"] = r[0]["id"].as<int>();
                    notificationJson["user_id"] = r[0]["user_id"].as<int>();
                    notificationJson["type"] = r[0]["type"].as<std::string>();
                    notificationJson["is_read"] = r[0]["is_read"].as<bool>();
                    notificationJson["created_at"] = r[0]["created_at"].as<std::string>();

                    Json::Value payloadJson;
                    const std::string payloadText = r[0]["payload"].as<std::string>();
                    Json::CharReaderBuilder readerBuilder;
                    std::unique_ptr<Json::CharReader> reader(readerBuilder.newCharReader());
                    JSONCPP_STRING errs;
                    if (reader->parse(payloadText.data(), payloadText.data() + payloadText.size(), &payloadJson, &errs)) {
                        notificationJson["payload"] = payloadJson;
                    } else {
                        notificationJson["payload_raw"] = payloadText;
                    }

                    NotificationHub::pushNotification(userId, notificationJson);
                },
                [](const drogon::orm::DrogonDbException&) {},
                userIdStr, type, payloadStr);
    };

    // 在写入前查询用户的 in-app 设置，若无记录则默认启用。
    dbClient->execSqlAsync(
            "SELECT in_app_enabled FROM notification_setting "
            "WHERE user_id = $1::bigint AND notification_type = $2",
            [=](const drogon::orm::Result& r) {
                bool inAppEnabled = true;
                if (!r.empty()) {
                    inAppEnabled = r[0]["in_app_enabled"].as<bool>();
                }
                insertAndPush(inAppEnabled);
            },
            [=](const drogon::orm::DrogonDbException&) { insertAndPush(true); }, userIdStr, type);
}