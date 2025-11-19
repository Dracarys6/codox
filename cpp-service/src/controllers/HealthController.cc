#include "HealthController.h"

#include <drogon/HttpClient.h>
#include <drogon/drogon.h>
#include <drogon/orm/DbClient.h>
#include <json/json.h>

#include <chrono>
#include <iomanip>
#include <sstream>
#include <string>

#include "../utils/ResponseUtils.h"

namespace {
/**
 * 获取当前时间戳（ISO 8601 格式）
 */
std::string getCurrentTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;

    std::stringstream ss;
    ss << std::put_time(std::gmtime(&time_t), "%Y-%m-%dT%H:%M:%S");
    ss << "." << std::setfill('0') << std::setw(3) << ms.count() << "Z";
    return ss.str();
}

/**
 * 从配置文件读取配置值
 */
std::string getConfigValue(const std::string& key, const std::string& defaultValue = "") {
    auto& appConfig = drogon::app().getCustomConfig();
    if (appConfig.isMember(key)) {
        return appConfig[key].asString();
    }
    return defaultValue;
}

/**
 * 检查 Meilisearch 服务健康状态
 */
void checkMeilisearch(Json::Value& healthJson) {
    try {
        std::string meilisearchUrl = getConfigValue("meilisearch_url", "http://localhost:7700");
        auto client = drogon::HttpClient::newHttpClient(meilisearchUrl);
        auto req = drogon::HttpRequest::newHttpRequest();
        req->setMethod(drogon::Get);
        req->setPath("/health");

        // 使用同步请求（健康检查需要快速响应）
        auto [result, resp] = client->sendRequest(req);
        if (result == drogon::ReqResult::Ok && resp && resp->getStatusCode() == drogon::k200OK) {
            healthJson["meilisearch"] = "healthy";
            auto jsonPtr = resp->getJsonObject();
            if (jsonPtr && jsonPtr->isMember("status")) {
                healthJson["meilisearch_status"] = (*jsonPtr)["status"].asString();
            }
        } else {
            healthJson["meilisearch"] = "unhealthy";
            if (resp) {
                healthJson["meilisearch_error"] = "HTTP " + std::to_string(resp->getStatusCode());
            } else {
                healthJson["meilisearch_error"] =
                        (result == drogon::ReqResult::Ok) ? "No response" : "Connection failed";
            }
        }
    } catch (const std::exception& e) {
        healthJson["meilisearch"] = "unhealthy";
        healthJson["meilisearch_error"] = std::string(e.what());
    } catch (...) {
        healthJson["meilisearch"] = "unhealthy";
        healthJson["meilisearch_error"] = "Unknown error";
    }
}

/**
 * 检查 MinIO 服务健康状态
 */
void checkMinIO(Json::Value& healthJson) {
    try {
        std::string minioEndpoint = getConfigValue("minio_endpoint", "localhost:9000");
        std::string minioUrl = "http://" + minioEndpoint;
        auto client = drogon::HttpClient::newHttpClient(minioUrl);
        auto req = drogon::HttpRequest::newHttpRequest();
        req->setMethod(drogon::Get);
        req->setPath("/minio/health/live");

        // 使用同步请求
        auto [result, resp] = client->sendRequest(req);
        if (result == drogon::ReqResult::Ok && resp && resp->getStatusCode() == drogon::k200OK) {
            healthJson["minio"] = "healthy";
        } else {
            healthJson["minio"] = "unhealthy";
            if (resp) {
                healthJson["minio_error"] = "HTTP " + std::to_string(resp->getStatusCode());
            } else {
                healthJson["minio_error"] = (result == drogon::ReqResult::Ok) ? "No response" : "Connection failed";
            }
        }
    } catch (const std::exception& e) {
        healthJson["minio"] = "unhealthy";
        healthJson["minio_error"] = std::string(e.what());
    } catch (...) {
        healthJson["minio"] = "unhealthy";
        healthJson["minio_error"] = "Unknown error";
    }
}
}  // namespace

void HealthController::health(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    Json::Value healthJson;
    healthJson["service"] = "cpp-service";
    healthJson["timestamp"] = getCurrentTimestamp();

    // 数据库健康检查
    Json::Value dbStatus;
    try {
        auto db = drogon::app().getDbClient();
        if (!db) {
            dbStatus["status"] = "unhealthy";
            dbStatus["error"] = "Database client not available";
        } else {
            // 执行实际查询测试连接
            auto result = db->execSqlSync("SELECT 1 as health_check");
            if (!result.empty()) {
                dbStatus["status"] = "healthy";
                auto dbType = db->type();
                dbStatus["type"] = (dbType == drogon::orm::ClientType::PostgreSQL) ? "PostgreSQL" : "Unknown";
            } else {
                dbStatus["status"] = "unhealthy";
                dbStatus["error"] = "Query returned no results";
            }
        }
    } catch (const std::exception& e) {
        dbStatus["status"] = "unhealthy";
        dbStatus["error"] = std::string(e.what());
    } catch (...) {
        dbStatus["status"] = "unhealthy";
        dbStatus["error"] = "Unknown exception";
    }
    healthJson["database"] = dbStatus;

    // Meilisearch 健康检查
    checkMeilisearch(healthJson);

    // MinIO 健康检查
    checkMinIO(healthJson);

    // 确定整体状态
    std::string overallStatus = "ok";
    drogon::HttpStatusCode httpStatusCode = drogon::k200OK;

    // 如果任何关键服务不可用，标记为 degraded 或 unhealthy
    if (dbStatus["status"].asString() != "healthy") {
        overallStatus = "unhealthy";
        httpStatusCode = drogon::k503ServiceUnavailable;
    } else if (healthJson["meilisearch"].asString() != "healthy" || healthJson["minio"].asString() != "healthy") {
        overallStatus = "degraded";
        // degraded 状态仍然返回 200，但明确标记状态
    }

    healthJson["status"] = overallStatus;

    // 创建响应
    ResponseUtils::sendSuccess(callback, healthJson, httpStatusCode);
}
