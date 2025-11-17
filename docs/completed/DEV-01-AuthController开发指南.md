# AuthController 开发指南

## 🔍 当前代码问题分析

你的代码中有几个需要修正的地方：

1. **头文件路径错误**：`<dragon/HttpController.h>` → `<drogon/HttpController.h>`
2. **类型名错误**：`HttpRequestPte` → `HttpRequestPtr`，`HttpResponse` → `HttpResponsePtr`
3. **函数定义语法错误**：`void registerHandler::class Authcontroller` → `void AuthController::registerHandler`
4. **JSON 解析方法**：`req->getJsonObject()` → `req->jsonObject()`
5. **函数签名不一致**：头文件和实现文件的参数类型不匹配

---

## 📋 完整的 AuthController 实现指南

### 1. 修正后的头文件 (AuthController.h)

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>
#include <string>

using namespace drogon;

class AuthController : public HttpController<AuthController> {
public:
    // 路由绑定声明
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(AuthController::registerHandler, "/api/auth/register", Post);
        ADD_METHOD_TO(AuthController::loginHandler, "/api/auth/login", Post);
        ADD_METHOD_TO(AuthController::refreshHandler, "/api/auth/refresh", Post);
    METHOD_LIST_END

    // 方法声明
    void registerHandler(const HttpRequestPtr& req,
                        std::function<void(const HttpResponsePtr&)>&& callback);

    void loginHandler(const HttpRequestPtr& req,
                     std::function<void(const HttpResponsePtr&)>&& callback);

    void refreshHandler(const HttpRequestPtr& req,
                       std::function<void(const HttpResponsePtr&)>&& callback);

private:
    // 辅助方法：统一错误响应
    void sendError(const HttpResponsePtr& callback,
                   const std::string& message,
                   int statusCode = k400BadRequest);

    // 辅助方法：统一成功响应
    void sendSuccess(const HttpResponsePtr& callback,
                    const Json::Value& data,
                    int statusCode = k200OK);
};
```

---

### 2. 注册接口实现 (registerHandler)

**功能流程：**

1. 解析 JSON 请求体（email, password, nickname 可选）
2. 验证输入（邮箱格式、密码长度）
3. 检查邮箱是否已存在
4. 哈希密码
5. 插入数据库（user 表和 user_profile 表）
6. 返回用户 ID

**实现代码框架：**

```cpp
#include "AuthController.h"
#include "utils/PasswordUtils.h"
#include "utils/DbUtils.h"
#include <drogon/drogon.h>
#include <json/json.h>
#include <regex>

void AuthController::registerHandler(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 解析 JSON 请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string email = json.get("email", "").asString();
    std::string password = json.get("password", "").asString();
    std::string nickname = json.get("nickname", "").asString(); // 可选

    // 2. 验证输入
    if (email.empty() || password.empty()) {
        sendError(callback, "Email and password are required", k400BadRequest);
        return;
    }

    // 验证邮箱格式（简单验证）
    std::regex emailRegex(R"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})");
    if (!std::regex_match(email, emailRegex)) {
        sendError(callback, "Invalid email format", k400BadRequest);
        return;
    }

    // 验证密码长度
    if (password.size() < 8) {
        sendError(callback, "Password must be at least 8 characters", k400BadRequest);
        return;
    }

    // 3. 检查邮箱是否已存在
    auto db = drogon::app().getDbClient();
    db->execSqlAsync(
        "SELECT id FROM \"user\" WHERE email = $1",
        [=, callback = std::move(callback)](const drogon::orm::Result& r) mutable {
            // 邮箱已存在
            if (!r.empty()) {
                sendError(callback, "Email already exists", k409Conflict);
                return;
            }

            // 4. 哈希密码
            std::string passwordHash = PasswordUtils::hashPassword(password);

            // 5. 插入数据库（使用事务）
            db->execTransactionAsync(
                [email, passwordHash, nickname](drogon::orm::TransactionPtr& transPtr) {
                    // 插入 user 表
                    transPtr->execSqlAsync(
                        "INSERT INTO \"user\" (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
                        [=, transPtr](const drogon::orm::Result& r) mutable {
                            if (r.empty()) {
                                throw std::runtime_error("Failed to create user");
                            }
                            int userId = r[0]["id"].as<int>();

                            // 插入 user_profile 表（如果有 nickname）
                            if (!nickname.empty()) {
                                transPtr->execSqlAsync(
                                    "INSERT INTO user_profile (user_id, nickname) VALUES ($1, $2)",
                                    [=](const drogon::orm::Result&) {},
                                    [](const drogon::orm::DrogonDbException& e) {
                                        throw std::runtime_error(e.base().what());
                                    },
                                    userId, nickname
                                );
                            } else {
                                // 即使没有 nickname，也创建 profile 记录（可选）
                                transPtr->execSqlAsync(
                                    "INSERT INTO user_profile (user_id) VALUES ($1)",
                                    [](const drogon::orm::Result&) {},
                                    [](const drogon::orm::DrogonDbException& e) {
                                        throw std::runtime_error(e.base().what());
                                    },
                                    userId
                                );
                            }
                        },
                        [](const drogon::orm::DrogonDbException& e) {
                            throw std::runtime_error(e.base().what());
                        },
                        email, passwordHash, "viewer" // 默认角色
                    );
                },
                [=, callback = std::move(callback)](const drogon::orm::Result& r) mutable {
                    // 事务成功
                    int userId = r[0]["id"].as<int>();
                    Json::Value responseJson;
                    responseJson["id"] = userId;
                    responseJson["email"] = email;
                    responseJson["message"] = "User registered successfully";
                    sendSuccess(callback, responseJson, k201Created);
                },
                [=, callback = std::move(callback)](const drogon::orm::DrogonDbException& e) mutable {
                    // 事务失败
                    sendError(callback, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                }
            );
        },
        [=, callback = std::move(callback)](const drogon::orm::DrogonDbException& e) mutable {
            // 查询失败（通常是数据库连接问题）
            sendError(callback, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        email
    );
}
```

**注意**：上面的异步嵌套较复杂。下面是简化版本（先查后插，不用事务）：

```cpp
void AuthController::registerHandler(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 解析和验证（同上）
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string email = json.get("email", "").asString();
    std::string password = json.get("password", "").asString();
    std::string nickname = json.get("nickname", "").asString();

    // 验证输入
    if (email.empty() || password.empty()) {
        sendError(callback, "Email and password are required", k400BadRequest);
        return;
    }

    if (password.size() < 8) {
        sendError(callback, "Password must be at least 8 characters", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();

    // 2. 检查邮箱是否存在
    db->execSqlAsync(
        "SELECT id FROM \"user\" WHERE email = $1",
        [=, callback = std::move(callback), password, nickname](const drogon::orm::Result& r) mutable {
            if (!r.empty()) {
                sendError(callback, "Email already exists", k409Conflict);
                return;
            }

            // 3. 哈希密码
            std::string passwordHash = PasswordUtils::hashPassword(password);

            // 4. 插入用户
            db->execSqlAsync(
                "INSERT INTO \"user\" (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
                [=, callback = std::move(callback), nickname](const drogon::orm::Result& r) mutable {
                    if (r.empty()) {
                        sendError(callback, "Failed to create user", k500InternalServerError);
                        return;
                    }

                    int userId = r[0]["id"].as<int>();

                    // 5. 插入用户资料（如果有 nickname）
                    if (!nickname.empty()) {
                        db->execSqlAsync(
                            "INSERT INTO user_profile (user_id, nickname) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET nickname = $2",
                            [=, callback = std::move(callback), userId, email](const drogon::orm::Result&) mutable {
                                Json::Value responseJson;
                                responseJson["id"] = userId;
                                responseJson["email"] = email;
                                sendSuccess(callback, responseJson, k201Created);
                            },
                            [=, callback = std::move(callback)](const drogon::orm::DrogonDbException& e) mutable {
                                sendError(callback, "Database error", k500InternalServerError);
                            },
                            userId, nickname
                        );
                    } else {
                        Json::Value responseJson;
                        responseJson["id"] = userId;
                        responseJson["email"] = email;
                        sendSuccess(callback, responseJson, k201Created);
                    }
                },
                [=, callback = std::move(callback)](const drogon::orm::DrogonDbException& e) mutable {
                    sendError(callback, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                email, passwordHash, "viewer"
            );
        },
        [=, callback = std::move(callback)](const drogon::orm::DrogonDbException& e) mutable {
            sendError(callback, "Database error", k500InternalServerError);
        },
        email
    );
}
```

---

### 3. 登录接口实现 (loginHandler)

**功能流程：**

1. 解析 email/phone 和 password
2. 查询数据库获取用户信息和密码哈希
3. 验证密码
4. 生成 JWT token（access_token + refresh_token）
5. 返回 token 和用户信息

**实现代码：**

```cpp
#include "utils/JwtUtil.h"

void AuthController::loginHandler(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 解析 JSON
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string account = json.get("account", "").asString(); // email 或 phone
    std::string password = json.get("password", "").asString();

    if (account.empty() || password.empty()) {
        sendError(callback, "Account and password are required", k400BadRequest);
        return;
    }

    // 2. 查询用户（支持 email 或 phone 登录）
    auto db = drogon::app().getDbClient();
    db->execSqlAsync(
        "SELECT u.id, u.email, u.password_hash, u.role, p.nickname, p.avatar_url "
        "FROM \"user\" u "
        "LEFT JOIN user_profile p ON u.id = p.user_id "
        "WHERE u.email = $1 OR u.phone = $1",
        [=, callback = std::move(callback), password](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                sendError(callback, "Invalid credentials", k401Unauthorized);
                return;
            }

            // 3. 验证密码
            std::string storedHash = r[0]["password_hash"].as<std::string>();
            if (!PasswordUtils::verifyPassword(password, storedHash)) {
                sendError(callback, "Invalid credentials", k401Unauthorized);
                return;
            }

            // 4. 获取用户信息
            int userId = r[0]["id"].as<int>();
            std::string email = r[0]["email"].as<std::string>();
            std::string role = r[0]["role"].as<std::string>();
            std::string nickname = r[0]["nickname"].isNull() ? "" : r[0]["nickname"].as<std::string>();
            std::string avatarUrl = r[0]["avatar_url"].isNull() ? "" : r[0]["avatar_url"].as<std::string>();

            // 5. 生成 JWT token
            std::string secret = "your-secret-key"; // 应该从配置文件读取
            std::string accessToken = JwtUtil::generateToken(userId, secret, 900); // 15分钟
            std::string refreshToken = JwtUtil::generateToken(userId, secret, 2592000); // 30天

            // 6. 返回响应
            Json::Value responseJson;
            responseJson["access_token"] = accessToken;
            responseJson["refresh_token"] = refreshToken;
            responseJson["user"]["id"] = userId;
            responseJson["user"]["email"] = email;
            responseJson["user"]["role"] = role;
            responseJson["user"]["nickname"] = nickname;
            responseJson["user"]["avatar_url"] = avatarUrl;

            sendSuccess(callback, responseJson);
        },
        [=, callback = std::move(callback)](const drogon::orm::DrogonDbException& e) mutable {
            sendError(callback, "Database error", k500InternalServerError);
        },
        account
    );
}
```

---

### 4. 刷新 Token 接口实现 (refreshHandler)

**功能流程：**

1. 解析 refresh_token
2. 验证 refresh_token 有效性
3. 提取 user_id
4. 生成新的 access_token
5. 返回新的 access_token

**实现代码：**

```cpp
void AuthController::refreshHandler(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 解析 JSON
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string refreshToken = json.get("refresh_token", "").asString();

    if (refreshToken.empty()) {
        sendError(callback, "Refresh token is required", k400BadRequest);
        return;
    }

    // 2. 验证 refresh_token
    std::string secret = "your-secret-key"; // 从配置文件读取
    if (!JwtUtil::verifyToken(refreshToken, secret)) {
        sendError(callback, "Invalid or expired refresh token", k401Unauthorized);
        return;
    }

    // 3. 提取 user_id
    int userId = JwtUtil::getUserIdFromToken(refreshToken);
    if (userId == -1) {
        sendError(callback, "Invalid token", k401Unauthorized);
        return;
    }

    // 4. 生成新的 access_token
    std::string newAccessToken = JwtUtil::generateToken(userId, secret, 900);

    // 5. 返回响应
    Json::Value responseJson;
    responseJson["access_token"] = newAccessToken;

    sendSuccess(callback, responseJson);
}
```

---

### 5. 辅助方法实现

```cpp
void AuthController::sendError(
    const std::function<void(const HttpResponsePtr&)>& callback,
    const std::string& message,
    int statusCode) {
    
    Json::Value errorJson;
    errorJson["error"] = message;
    auto resp = HttpResponse::newHttpJsonResponse(errorJson);
    resp->setStatusCode(statusCode);
    callback(resp);
}

void AuthController::sendSuccess(
    const std::function<void(const HttpResponsePtr&)>& callback,
    const Json::Value& data,
    int statusCode) {
    
    auto resp = HttpResponse::newHttpJsonResponse(data);
    resp->setStatusCode(statusCode);
    callback(resp);
}
```

---

## ⚙️ 配置 JWT Secret

**推荐方式：从配置文件读取**

在 `config.json` 中添加：

```json
{
  "app": {
    "jwt_secret": "your-secret-key-change-in-production",
    "jwt_access_expires_in": 900,
    "jwt_refresh_expires_in": 2592000
  }
}
```

在代码中读取：

```cpp
// 在方法中
auto& appConfig = drogon::app().getCustomConfig();
std::string secret = appConfig.get("jwt_secret", "default-secret").asString();
```

---

## 🧪 测试接口

### 注册

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test12345",
    "nickname": "测试用户"
  }'
```

### 登录

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "account": "test@example.com",
    "password": "test12345"
  }'
```

### 刷新 Token

```bash
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your_refresh_token_here"
  }'
```

---

## ⚠️ 注意事项

1. **JWT Secret**：生产环境务必使用强密钥，不要硬编码
2. **密码验证**：不要在日志中输出密码或密码哈希
3. **错误信息**：登录失败时统一返回 "Invalid credentials"，不要暴露用户是否存在
4. **SQL 注入**：始终使用参数化查询（`$1, $2`）
5. **异步回调**：注意 `std::move(callback)` 的使用，避免重复调用

---

## 🚀 开始实现

按照这个指南，一步步实现每个接口。建议顺序：

1. 先实现 `sendError` 和 `sendSuccess` 辅助方法
2. 实现注册接口（最简单的）
3. 实现登录接口
4. 实现刷新 Token 接口
5. 测试每个接口

**遇到具体问题随时问我！** 💪
