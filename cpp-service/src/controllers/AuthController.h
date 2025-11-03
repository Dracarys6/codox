//认证控制器
#pragma once
#include<drogon/HttpController.h>
#include<drogon/drogon.h>
#include<functional>
#include<string>

using namespace drogon;

class AuthController : public HttpController<AuthController> {
public:
    //路由绑定声明 (METHOD_LIST_BEGIN 到 METHOD_LIST_END之间)
    METHOD_LIST_BEGIN
        //注册接口：POST /api/auth/register
        ADD_METHOD_TO(AuthController::registerHandler, "/api/auth/register", Post);
    //登录接口：POST /api/auth/login
    ADD_METHOD_TO(AuthController::loginHandler, "/api/auth/login", Post);
    //刷新token
    ADD_METHOD_TO(AuthController::refreshHandler, "/api/auth/refresh", Post);
    METHOD_LIST_END

        void registerHandler(const HttpRequestPtr& req,
            std::function<void(const HttpResponsePtr&)>&& callback);

    void loginHandler(const HttpRequestPtr& req,
        std::function<void(const HttpResponsePtr&)>&& callback);

    void refreshHandler(const HttpRequestPtr& req,
        std::function<void(const HttpResponsePtr&)>&& callback);

private:
    void sendError(const std::function<void(const HttpResponsePtr&)>& callback,
        const std::string& message,
        int statusCode = k400BadRequest);

    void sendSuccess(const std::function<void(const HttpResponsePtr&)>& callback,
        const Json::Value& data,
        int statusCode = k200OK);
};
