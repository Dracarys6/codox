#include "JwtAuthFilter.h"

#include <json/json.h>

#include <string>

#include "../utils/JwtUtil.h"

void JwtAuthFilter::doFilter(const HttpRequestPtr& req, drogon::FilterCallback&& fcb,
                             drogon::FilterChainCallback&& fccb) {
    // 1.从 Header 中提取 Authorization
    std::string authHeader = req->getHeader("Authorization");

    // 2.检查 Authorization header 是否存在
    if (authHeader.empty()) {
        Json::Value errorJson;
        errorJson["error"] = "Missing Authorization header";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        fcb(resp);
        return;
    }

    // 3.检查格式是否为 "Bearer <token>"
    const std::string bearerPrefix = "Bearer ";
    if (authHeader.size() <= bearerPrefix.size() || authHeader.substr(0, bearerPrefix.size()) != bearerPrefix) {
        Json::Value errorJson;
        errorJson["error"] = "Invalid Authorization header format. Expected: Bearer <token>";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        fcb(resp);
        return;
    }

    // 4.提取 token (去除 "Bearer"前缀)
    std::string token = authHeader.substr(bearerPrefix.size());

    // 5.从配置文件获取 JWT secret
    auto& appConfig = drogon::app().getCustomConfig();
    std::string secret = appConfig.get("jwt_secret", "").asString();
    if (secret.empty()) {
        // 如果没有配置,使用默认值
        secret = "default-secret";
    }

    // 6.验证 token 有效性
    if (!JwtUtil::verifyToken(token, secret)) {
        Json::Value errorJson;
        errorJson["error"] = "Invalid or expired token";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        fcb(resp);
        return;
    }

    // 7.从 token 中提取 user_id
    int userId = JwtUtil::getUserIdFromToken(token);
    if (userId == -1) {
        Json::Value errorJson;
        errorJson["error"] = "Failed to extract user information from token";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        fcb(resp);
        return;
    }

    // 8. 将 user_id 存入请求上下文
    // 使用 setParameter 存储字符串格式的 user_id
    req->setParameter("user_id", std::to_string(userId));

    // 9. Token 验证通过，继续执行下一个过滤器或控制器
    fccb();
}