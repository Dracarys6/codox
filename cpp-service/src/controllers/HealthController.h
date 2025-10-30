#ifndef HEALTH_CONTROLLER_H
#define HEALTH_CONTROLLER_H

#include <drogon/HttpController.h>
#include <pqxx/pqxx>
#include <array>
#include <drogon/drogon.h>

using namespace drogon;

class HealthController : public drogon::HttpController<HealthController> {
public:
    METHOD_LIST_BEGIN
        // 注册路由：GET请求访问/health路径时调用health方法
        ADD_METHOD_TO(HealthController::health, "/health", Get);
    METHOD_LIST_END

    /**
     * @brief 健康检查接口
     * 检查服务状态和数据库连接情况
     */
    void health(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};

#endif // HEALTH_CONTROLLER_H