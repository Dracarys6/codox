#include "AuthController.h"

#include <drogon/drogon.h>
#include <jsoncpp/json/json.h>

#include <memory>
#include <regex>
#include <sstream>

#include "../utils/DbUtils.h"
#include "../utils/JwtUtil.h"
#include "../utils/PasswordUtils.h"
#include "../utils/ResponseUtils.h"

void AuthController::registerHandler(const HttpRequestPtr& req,
                                     std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.解析json请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    std::string email = json["email"].asString();
    std::string password = json["password"].asString();
    std::string nickname = json["nickname"].asString();

    // 2.验证输入
    if (email.empty() || password.empty()) {
        ResponseUtils::sendError(callback, "Email and password are required", k400BadRequest);
        return;
    }
    // 验证邮箱格式
    std::regex emailRegex(R"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})");
    if (!std::regex_match(email, emailRegex)) {
        ResponseUtils::sendError(callback, "Invalid email format", k400BadRequest);
        return;
    }
    // 验证密码长度
    if (password.size() < 8) {
        ResponseUtils::sendError(callback, "Password must be at least 8 characters", k400BadRequest);
        return;
    }

    // 3.检查邮箱是否已存在（在 handler 中调用，run() 之后）
    //  根据配置 is_fast=false，使用 getDbClient()
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    // 使用 shared_ptr 包装 callback 以支持嵌套异步调用
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT id FROM \"user\" WHERE email = $1",
            [=](const drogon::orm::Result& r) mutable {
                if (!r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Email already exists", k409Conflict);
                    return;
                }

                // 4. 哈希密码
                std::string passwordHash = PasswordUtils::hashPassword(password);

                // 5. 插入用户
                db->execSqlAsync(
                        "INSERT INTO \"user\" (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
                        [=](const drogon::orm::Result& r) mutable {
                            if (r.empty()) {
                                ResponseUtils::sendError(*callbackPtr, "Failed to create user",
                                                         k500InternalServerError);
                                return;
                            }

                            int userId = r[0]["id"].as<int>();
                            std::string userIdStr = std::to_string(userId);  // 保存字符串版本，避免重复转换

                            // 6. 插入用户资料（如果有 nickname）
                            if (!nickname.empty()) {
                                db->execSqlAsync(
                                        "INSERT INTO user_profile (user_id, nickname) VALUES ($1::integer, $2) ON "
                                        "CONFLICT (user_id) DO UPDATE SET nickname = $2",
                                        [=](const drogon::orm::Result&) mutable {
                                            Json::Value responseJson;
                                            responseJson["id"] = userId;
                                            responseJson["email"] = email;
                                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                                        },
                                        [=](const drogon::orm::DrogonDbException& e) mutable {
                                            ResponseUtils::sendError(*callbackPtr,
                                                                     "Database error: " + std::string(e.base().what()),
                                                                     k500InternalServerError);
                                        },
                                        userIdStr, nickname);  // 直接使用 userIdStr
                            } else {
                                Json::Value responseJson;
                                responseJson["id"] = userId;
                                responseJson["email"] = email;
                                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                            }
                        },
                        [=](const drogon::orm::DrogonDbException& e) mutable {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        email, passwordHash, "viewer");
            },
            [=](const drogon::orm::DrogonDbException& e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            email);
}

void AuthController::loginHandler(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.解析json请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string account = json["account"].asString();  // email 或 phone
    std::string password = json["password"].asString();

    if (account.empty() || password.empty()) {
        ResponseUtils::sendError(callback, "Account and password are required", k400BadRequest);
        return;
    }

    // 2.查询用户(支持email或phone登录)
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT u.id, u.email, u.password_hash, u.role, p.nickname, p.avatar_url "
            "FROM \"user\" u "
            "LEFT JOIN user_profile p ON u.id = p.user_id "
            "WHERE u.email = $1 OR u.phone = $1",
            [=](const drogon::orm::Result& r) mutable {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Invalid credentials", k401Unauthorized);
                    return;
                }

                // 3.验证密码
                std::string storedHash = r[0]["password_hash"].as<std::string>();
                if (!PasswordUtils::verifyPassword(password, storedHash)) {
                    ResponseUtils::sendError(*callbackPtr, "Invalid credentials", k401Unauthorized);
                    return;
                }

                // 4.获取用户信息
                int userId = r[0]["id"].as<int>();
                std::string email = r[0]["email"].as<std::string>();
                std::string role = r[0]["role"].as<std::string>();
                std::string nickname = r[0]["nickname"].isNull() ? "" : r[0]["nickname"].as<std::string>();
                std::string avatarUrl = r[0]["avatar_url"].isNull() ? "" : r[0]["avatar_url"].as<std::string>();

                // 5.生成JWT token
                auto& appConfig = drogon::app().getCustomConfig();
                std::string accessSecret = appConfig.get("jwt_secret", "default-secret").asString();
                int accessExpiresIn = appConfig.get("jwt_access_expires_in", 900).asInt();
                int refreshExpiresIn = appConfig.get("jwt_refresh_expires_in", 2592000).asInt();
                std::string chatSecret =
                        appConfig.isMember("chat_jwt_secret") ? appConfig["chat_jwt_secret"].asString() : accessSecret;
                int chatExpiresIn = appConfig.get("chat_jwt_expires_in", accessExpiresIn).asInt();

                std::string accessToken = JwtUtil::generateToken(userId, accessSecret, accessExpiresIn);
                std::string refreshToken = JwtUtil::generateToken(userId, accessSecret, refreshExpiresIn);
                std::string chatToken = JwtUtil::generateToken(userId, chatSecret, chatExpiresIn);

                // 6. 返回响应（格式化 JSON）
                Json::Value responseJson;
                responseJson["access_token"] = accessToken;
                responseJson["refresh_token"] = refreshToken;
                responseJson["chat_token"] = chatToken;

                Json::Value userJson;
                userJson["id"] = userId;
                userJson["email"] = email;
                userJson["role"] = role;
                userJson["nickname"] = nickname;
                userJson["avatar_url"] = avatarUrl;
                responseJson["user"] = userJson;

                ResponseUtils::sendSuccess(*callbackPtr, responseJson);
            },
            [=](const drogon::orm::DrogonDbException& e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            account);
}

void AuthController::refreshHandler(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1.解析JSON
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string refreshToken = json["refresh_token"].asString();

    if (refreshToken.empty()) {
        ResponseUtils::sendError(callback, "Refresh token is required", k400BadRequest);
        return;
    }

    // 2.验证refresh_token 有效性
    auto& appConfig = drogon::app().getCustomConfig();
    std::string accessSecret = appConfig.get("jwt_secret", "default-secret").asString();
    if (!JwtUtil::verifyToken(refreshToken, accessSecret)) {
        ResponseUtils::sendError(callback, "Invalid or expired refresh token", k401Unauthorized);
        return;
    }

    // 3.提取user_id
    int userId = JwtUtil::getUserIdFromToken(refreshToken);
    if (userId == -1) {
        ResponseUtils::sendError(callback, "Invalid token", k401Unauthorized);
        return;
    }

    // 4.生成新的access_token
    int accessExpiresIn = appConfig.get("jwt_access_expires_in", 900).asInt();
    int chatExpiresIn = appConfig.get("chat_jwt_expires_in", accessExpiresIn).asInt();
    std::string chatSecret =
            appConfig.isMember("chat_jwt_secret") ? appConfig["chat_jwt_secret"].asString() : accessSecret;
    std::string newAccessToken = JwtUtil::generateToken(userId, accessSecret, accessExpiresIn);
    std::string newChatToken = JwtUtil::generateToken(userId, chatSecret, chatExpiresIn);

    // 5.返回响应
    Json::Value responseJson;
    responseJson["access_token"] = newAccessToken;
    responseJson["chat_token"] = newChatToken;
    ResponseUtils::sendSuccess(callback, responseJson);
}
