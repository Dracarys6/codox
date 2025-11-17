#include "HealthController.h"

#include <drogon/drogon.h>
#include <drogon/orm/DbClient.h>
#include <json/json.h>

#include <string>

void HealthController::health(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    Json::Value responseJson;
    responseJson["status"] = "ok";
    responseJson["service"] = "cpp-service";

    // 测试数据库连接
    try {
        // 尝试获取默认数据库客户端
        auto db = drogon::app().getDbClient();
        if (db) {
            responseJson["database"] = "connected";
            // type() 返回枚举，转换为字符串
            auto dbType = db->type();
            responseJson["db_type"] = (dbType == drogon::orm::ClientType::PostgreSQL) ? "PostgreSQL" : "Unknown";
        } else {
            responseJson["database"] = "disconnected";
            responseJson["db_error"] = "getDbClient() returned nullptr";
        }
    } catch (const std::exception& e) {
        responseJson["database"] = "error";
        responseJson["db_error"] = std::string(e.what());
    } catch (...) {
        responseJson["database"] = "error";
        responseJson["db_error"] = "unknown_exception";
    }

    auto resp = HttpResponse::newHttpJsonResponse(responseJson);
    resp->setStatusCode(k200OK);
    callback(resp);
}
