#pragma once
#include <drogon/drogon.h>

#include <functional>
#include <string>

class PermissionUtils {
public:
    // 检查用户权限,返回 owner/editor/viewer/none
    static void checkPermission(int docId, int userId, std::function<void(const std::string&)> successCallback,
                                std::function<void(const std::string&)> errorCallback);

    // 同步版本
    static std::string checkPermissionSync(int docId, int userId);

    // 检查是否有指定权限
    static void hasPermission(int docId, int userId, const std::string& requiredPermission,
                              std::function<void(bool)> callback);
};