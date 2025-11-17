#include "NotificationUtils.h"

#include <drogon/drogon.h>
#include <json/json.h>

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

void NotificationUtils::insertNotification(int userId, const std::string& type, const Json::Value& payload) {
    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);

    auto db = drogon::app().getDbClient();
    if (!db) return;

    db->execSqlAsync(
            "INSERT INTO notification (user_id, type, payload) VALUES ($1::integer, $2, $3::jsonb)",
            [](const drogon::orm::Result&) {}, [](const drogon::orm::DrogonDbException&) {}, std::to_string(userId),
            type, payloadStr);
}