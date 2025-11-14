// 在创建评论、任务等操作时，需要触发通知
#pragma once
#include <json/json.h>

#include <string>

class NotificationUtils {
public:
    // 创建评论通知
    static void createCommentNotification(int docId, int commentId, int authorId, int targetUserId);

    // 创建任务分配通知
    static void createTaskAssignmentNotification(int docId, int taskId, int assigneeId);

    // 创建任务状态变更通知
    static void createTaskStatusNotification(int docId, int taskId, int assigneeId, const std::string& status);

    // 创建文档权限变更通知
    static void createPermissionChangeNotification(int docId, int userId, const std::string& permission);

private:
    static void insertNotification(int userId, const std::string& type, const Json::Value& payload);
};
