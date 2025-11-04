#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

//用户信息控制器
class UserController : public drogon::HttpController<UserController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(UserController::getMe, "/api/users/me", Get, "JwtAuthFilter");
    ADD_METHOD_TO(UserController::updateMe, "/api/users/me", Patch, "JwtAuthFilter");
    METHOD_LIST_END

        // 获取当前用户信息(需要认证)
        void getMe(const HttpRequestPtr& req,
            std::function<void(const HttpResponsePtr&)>&& callback);
    // 更新当前用户信息(需要认证)
    void updateMe(const HttpRequestPtr& req,
        std::function<void(const HttpResponsePtr&)>&& callback);
};