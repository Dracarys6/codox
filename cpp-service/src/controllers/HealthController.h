#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>

#include <functional>

using namespace drogon;

/**
 * 健康检查控制器
 *
 * 提供详细的系统健康状态检查，包括：
 * - 数据库连接状态
 * - Meilisearch 搜索服务状态
 * - MinIO 对象存储服务状态
 * - 整体服务状态和时间戳
 */
class HealthController : public HttpController<HealthController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(HealthController::health, "/health", Get);
    METHOD_LIST_END

    /**
     * 检查系统健康状态
     *
     * 返回所有依赖服务的健康状态，包括：
     * - status: 整体状态（ok/degraded/unhealthy）
     * - timestamp: 检查时间戳
     * - database: 数据库状态
     * - meilisearch: 搜索服务状态
     * - minio: 对象存储状态
     *
     * HTTP 状态码：
     * - 200: 所有服务正常
     * - 503: 部分或全部服务不可用
     */
    void health(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
};
