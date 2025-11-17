#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>

using namespace drogon;

// 健康检查(连接状态)控制器
class HealthController : public HttpController<HealthController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(HealthController::health, "/health", Get);
    METHOD_LIST_END

    // 检查健康状态
    void health(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};
