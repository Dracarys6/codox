#include "PermissionUtils.h"

#include <drogon/drogon.h>

void PermissionUtils::checkPermission(int docId, int userId, std::function<void(const std::string&)> successCallback,
                                      std::function<void(const std::string&)> errorCallback) {
    auto db = drogon::app().getDbClient();
    if (!db) {
        errorCallback("Database not available");
        return;
    }

    // 检查权限
    db->execSqlAsync(
            "SELECT COALESCE(MAX(permission), 'none') as permission "
            "FROM ("
            "  SELECT permission FROM doc_acl "
            "  WHERE doc_id = $1::integer AND user_id = $2::integer "
            "  UNION ALL "
            "  SELECT 'owner'::VARCHAR(16) FROM document "
            "  WHERE id = $1::integer AND owner_id = $2::integer"
            ") perm",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    successCallback("none");
                    return;
                }
                successCallback(r[0]["permission"].as<std::string>());
            },
            [=](const drogon::orm::DrogonDbException& e) { errorCallback(std::string(e.base().what())); },
            std::to_string(docId), std::to_string(userId));
}

std::string PermissionUtils::checkPermissionSync(int docId, int userId) {
    auto db = drogon::app().getDbClient();
    auto result = db->execSqlSync("SELECT permission FROM doc_acl WHERE docId =$1 AND userId =$2 ");
    std::string permission = result[0]["permission"].as<std::string>();
    return permission;
}

void PermissionUtils::hasPermission(int docId, int userId, const std::string& requiredPermission,
                                    std::function<void(bool)> callback) {
    // 调用 checkPermission 获取实际权限
    checkPermission(
            docId, userId,
            [=](const std::string& actualPermission) {
                // 权限级别：owner > editor > viewer > none
                bool hasAccess = false;

                if (requiredPermission == "owner") {
                    // 只有 owner 可以执行 owner 操作
                    hasAccess = (actualPermission == "owner");
                } else if (requiredPermission == "editor") {
                    // owner 和 editor 可以执行编辑操作
                    hasAccess = (actualPermission == "owner" || actualPermission == "editor");
                } else if (requiredPermission == "viewer") {
                    // owner、editor 和 viewer 都可以查看
                    hasAccess = (actualPermission == "owner" || actualPermission == "editor" ||
                                 actualPermission == "viewer");
                } else {
                    // 未知的权限要求，返回 false
                    hasAccess = false;
                }

                callback(hasAccess);
            },
            [=](const std::string& error) {
                // 权限检查出错，返回 false
                callback(false);
            });
}
