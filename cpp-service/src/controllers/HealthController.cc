#include "HealthController.h"

void HealthController::health(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    Json::Value body;
    body["status"] = "ok";  // 服务基础状态

    try {
        // 从环境变量获取数据库连接字符串
        const char* conn = std::getenv("DB_URI");
        if (conn && std::strlen(conn) > 0) {
            // 尝试建立数据库连接并执行测试查询
            pqxx::connection c { conn };
            pqxx::work tx { c };
            auto r = tx.exec("SELECT 1");  // 简单查询验证连接
            (void)r;  // 避免未使用变量警告
            tx.commit();
            body["db"] = "ok";  // 数据库连接正常
        }
        else {
            body["db"] = "skipped";  // 未配置数据库连接，跳过检查
        }
    }
    catch (const std::exception& e) {
        body["db"] = "error";      // 数据库检查失败
        body["error"] = e.what();  // 记录错误信息
    }

    // 构建响应
    auto resp = HttpResponse::newHttpJsonResponse(body);
    resp->setStatusCode(k200OK);
    callback(resp);
}