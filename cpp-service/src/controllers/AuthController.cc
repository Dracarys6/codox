#include "AuthController.h"

#include <drogon/drogon.h>
#include <json/json.h>

#include <memory>
#include <regex>
#include <sstream>

#include "../utils/DbUtils.h"
#include "../utils/JwtUtil.h"
#include "../utils/PasswordUtils.h"
#include "../utils/ResponseUtils.h"
#include "../utils/TokenUtils.h"

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
            "SELECT u.id, u.email, u.password_hash, u.role, u.status, u.is_locked, u.last_login_at, "
            "p.nickname, p.avatar_url "
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
                std::string status = r[0]["status"].as<std::string>();
                bool isLocked = r[0]["is_locked"].as<bool>();
                if (status != "active") {
                    ResponseUtils::sendError(*callbackPtr, "Account is disabled", k403Forbidden);
                    return;
                }
                if (isLocked) {
                    ResponseUtils::sendError(*callbackPtr, "Account is locked", k403Forbidden);
                    return;
                }

                std::string nickname = r[0]["nickname"].isNull() ? "" : r[0]["nickname"].as<std::string>();
                std::string avatarUrl = r[0]["avatar_url"].isNull() ? "" : r[0]["avatar_url"].as<std::string>();

                // 5.生成JWT token
                auto& appConfig = drogon::app().getCustomConfig();
                std::string accessSecret = appConfig.get("jwt_secret", "default-secret").asString();
                int accessExpiresIn = appConfig.get("jwt_access_expires_in", 900).asInt();
                int refreshExpiresIn = appConfig.get("jwt_refresh_expires_in", 2592000).asInt();

                std::string accessToken = JwtUtil::generateToken(userId, accessSecret, accessExpiresIn);
                std::string refreshToken = JwtUtil::generateToken(userId, accessSecret, refreshExpiresIn);

                // 6. 返回响应（格式化 JSON）
                Json::Value responseJson;
                responseJson["access_token"] = accessToken;
                responseJson["refresh_token"] = refreshToken;

                Json::Value userJson;
                userJson["id"] = userId;
                userJson["email"] = email;
                userJson["role"] = role;
                userJson["status"] = status;
                userJson["is_locked"] = isLocked;
                if (!r[0]["last_login_at"].isNull()) {
                    userJson["last_login_at"] = r[0]["last_login_at"].as<std::string>();
                }
                userJson["nickname"] = nickname;
                userJson["avatar_url"] = avatarUrl;
                responseJson["user"] = userJson;

                auto responseData = std::make_shared<Json::Value>(responseJson);
                db->execSqlAsync(
                        "UPDATE \"user\" SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1",
                        [=](const drogon::orm::Result&) { ResponseUtils::sendSuccess(*callbackPtr, *responseData); },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        std::to_string(userId));
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
    std::string newAccessToken = JwtUtil::generateToken(userId, accessSecret, accessExpiresIn);

    // 5.返回响应
    Json::Value responseJson;
    responseJson["access_token"] = newAccessToken;
    ResponseUtils::sendSuccess(callback, responseJson);
}

void AuthController::forgotPasswordHandler(const HttpRequestPtr& req,
                                           std::function<void(const HttpResponsePtr&)>&& callback) {
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string email = json["email"].asString();
    if (email.empty()) {
        ResponseUtils::sendError(callback, "Email is required", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
            "SELECT id FROM \"user\" WHERE email = $1",
            [=](const drogon::orm::Result& r) mutable {
                Json::Value responseJson;
                responseJson["message"] = "如果邮箱存在，我们已发送重置指引";

                if (r.empty()) {
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                    return;
                }

                int userId = r[0]["id"].as<int>();
                std::string rawToken = TokenUtils::generateRandomHex(32);
                std::string tokenHash = TokenUtils::sha256(rawToken);

                auto& config = drogon::app().getCustomConfig();
                int ttlMinutes = 30;
                bool exposeToken = true;
                if (config.isMember("password_reset_token_ttl_minutes")) {
                    ttlMinutes = config["password_reset_token_ttl_minutes"].asInt();
                } else if (config.isMember("app") && config["app"].isMember("password_reset_token_ttl_minutes")) {
                    ttlMinutes = config["app"]["password_reset_token_ttl_minutes"].asInt();
                }
                if (ttlMinutes <= 0) {
                    ttlMinutes = 30;
                }
                if (config.isMember("expose_password_reset_token")) {
                    exposeToken = config["expose_password_reset_token"].asBool();
                } else if (config.isMember("app") && config["app"].isMember("expose_password_reset_token")) {
                    exposeToken = config["app"]["expose_password_reset_token"].asBool();
                }

                auto responsePtr = std::make_shared<Json::Value>(responseJson);
                std::string ttlMinutesStr = std::to_string(ttlMinutes);

                db->execSqlAsync(
                        "INSERT INTO password_reset_token (user_id, token_hash, expires_at) VALUES ($1::integer, $2, "
                        "NOW() + ($3::integer) * INTERVAL '1 minute') RETURNING id, expires_at",
                        [=](const drogon::orm::Result& insertResult) mutable {
                            if (!insertResult.empty()) {
                                (*responsePtr)["expires_at"] = insertResult[0]["expires_at"].as<std::string>();
                                if (exposeToken) {
                                    (*responsePtr)["reset_token"] = rawToken;
                                }
                            }
                            ResponseUtils::sendSuccess(*callbackPtr, *responsePtr);
                        },
                        [=](const drogon::orm::DrogonDbException& e) mutable {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        std::to_string(userId), tokenHash, ttlMinutesStr);
            },
            [=](const drogon::orm::DrogonDbException& e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            email);
}

void AuthController::resetPasswordHandler(const HttpRequestPtr& req,
                                          std::function<void(const HttpResponsePtr&)>&& callback) {
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string token = json["token"].asString();
    std::string newPassword = json["new_password"].asString();

    if (token.empty() || newPassword.empty()) {
        ResponseUtils::sendError(callback, "Token and new_password are required", k400BadRequest);
        return;
    }

    if (newPassword.size() < 8) {
        ResponseUtils::sendError(callback, "Password must be at least 8 characters", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    std::string tokenHash = TokenUtils::sha256(token);

    db->execSqlAsync(
            "SELECT id, user_id FROM password_reset_token WHERE token_hash = $1 AND expires_at > NOW() AND "
            "consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
            [=](const drogon::orm::Result& r) mutable {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Invalid or expired token", k400BadRequest);
                    return;
                }

                int tokenId = r[0]["id"].as<int>();
                int userId = r[0]["user_id"].as<int>();
                std::string passwordHash = PasswordUtils::hashPassword(newPassword);

                db->execSqlAsync(
                        "UPDATE \"user\" SET password_hash = $1, updated_at = NOW() WHERE id = $2",
                        [=](const drogon::orm::Result&) mutable {
                            db->execSqlAsync(
                                    "UPDATE password_reset_token SET consumed_at = NOW() WHERE id = $1 OR user_id = $2",
                                    [=](const drogon::orm::Result&) mutable {
                                        Json::Value responseJson;
                                        responseJson["message"] = "密码重置成功，请使用新密码登录";
                                        ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                                    },
                                    [=](const drogon::orm::DrogonDbException& e) mutable {
                                        ResponseUtils::sendError(*callbackPtr,
                                                                 "Database error: " + std::string(e.base().what()),
                                                                 k500InternalServerError);
                                    },
                                    std::to_string(tokenId), std::to_string(userId));
                        },
                        [=](const drogon::orm::DrogonDbException& e) mutable {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        passwordHash, std::to_string(userId));
            },
            [=](const drogon::orm::DrogonDbException& e) mutable {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                         k500InternalServerError);
            },
            tokenHash);
}
