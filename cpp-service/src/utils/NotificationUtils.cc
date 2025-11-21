#include "NotificationUtils.h"

#include <drogon/drogon.h>
#include <json/json.h>

#include <memory>
#include <unordered_set>

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

    auto recipients = std::make_shared<std::unordered_set<int>>();
    recipients->insert(authorId);
    auto dispatchNotifications = [=]() {
        for (int userId : *recipients) {
            insertNotification(userId, "comment", payload);
        }
    };

    db->execSqlAsync(
            "SELECT user_id FROM ("
            "   SELECT owner_id AS user_id FROM document WHERE id = $1::integer"
            "   UNION "
            "   SELECT user_id FROM doc_acl WHERE doc_id = $1::integer"
            ") participants",
            [=](const drogon::orm::Result& r) {
                for (const auto& row : r) {
                    recipients->insert(row["user_id"].as<int>());
                }
                dispatchNotifications();
            },
            [=](const drogon::orm::DrogonDbException&) {
                dispatchNotifications();
            },
            std::to_string(docId));
}

void NotificationUtils::createTaskAssignmentNotification(int docId, int taskId, int assigneeId) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["task_id"] = taskId;

    auto db = drogon::app().getDbClient();
    if (!db) return;

    auto recipients = std::make_shared<std::unordered_set<int>>();
    if (assigneeId > 0) {
        recipients->insert(assigneeId);
    }

    auto dispatchNotifications = [=]() {
        for (int userId : *recipients) {
            insertNotification(userId, "task_assigned", payload);
        }
    };

    db->execSqlAsync(
            "SELECT owner_id FROM document WHERE id = $1::integer",
            [=](const drogon::orm::Result& r) {
                if (!r.empty()) {
                    recipients->insert(r[0]["owner_id"].as<int>());
                }
                dispatchNotifications();
            },
            [=](const drogon::orm::DrogonDbException&) {
                dispatchNotifications();
            },
            std::to_string(docId));
}

void NotificationUtils::createTaskStatusNotification(int docId, int taskId, int assigneeId, const std::string& status) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["task_id"] = taskId;
    payload["status"] = status;

    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);

    auto db = drogon::app().getDbClient();
    if (!db) return;

    auto recipients = std::make_shared<std::unordered_set<int>>();
    if (assigneeId > 0) {
        recipients->insert(assigneeId);
    }

    db->execSqlAsync(
            "SELECT t.created_by, d.owner_id "
            "FROM task t "
            "INNER JOIN document d ON d.id = t.doc_id "
            "WHERE t.id = $1::integer",
            [=](const drogon::orm::Result& r) {
                if (!r.empty()) {
                    recipients->insert(r[0]["created_by"].as<int>());
                    recipients->insert(r[0]["owner_id"].as<int>());
                }
                for (int userId : *recipients) {
                    insertNotification(userId, "task_status_changed", payload);
                }
            },
            [=](const drogon::orm::DrogonDbException&) {
                for (int userId : *recipients) {
                    insertNotification(userId, "task_status_changed", payload);
                }
            },
            std::to_string(taskId));
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
            [](const drogon::orm::DrogonDbException&) {}, userIdStr, type, payloadStr);
}