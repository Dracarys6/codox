#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <json/json.h>

#include <functional>
#include <string>
#include <vector>

using namespace drogon;

class AdminUserController : public drogon::HttpController<AdminUserController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(AdminUserController::listUsers, "/api/admin/users", Get, "JwtAuthFilter");
    ADD_METHOD_TO(AdminUserController::exportUsers, "/api/admin/users/export", Get, "JwtAuthFilter");
    ADD_METHOD_TO(AdminUserController::updateUserStatus, "/api/admin/users/{1}", Patch, "JwtAuthFilter");
    ADD_METHOD_TO(AdminUserController::updateUserRoles, "/api/admin/users/{1}/roles", Post, "JwtAuthFilter");
    ADD_METHOD_TO(AdminUserController::getUserAnalytics, "/api/admin/user-analytics", Get, "JwtAuthFilter");
    METHOD_LIST_END

    void listUsers(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void exportUsers(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void updateUserStatus(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback,
                          const std::string& userIdPath);
    void updateUserRoles(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback,
                         const std::string& userIdPath);
    void getUserAnalytics(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

private:
    struct UserListOptions {
        int page{1};
        int pageSize{20};
        int offset{0};
        std::string whereClause;
        std::vector<std::string> params;
        std::string orderExpr;
        std::string orderDirection;
    };

    bool ensureAdmin(int userId, std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                     std::function<void()> onSuccess);

    bool parseUserListOptions(const HttpRequestPtr& req, UserListOptions& options,
                              std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback, bool forExport);

    void fetchUserDetail(int targetUserId, std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                         std::function<void(const Json::Value&)> onSuccess);

    void writeAuditLog(int adminId, int targetUserId, const std::string& action, const Json::Value& payload);

    static Json::Value buildUserJson(const drogon::orm::Row& row);
};
