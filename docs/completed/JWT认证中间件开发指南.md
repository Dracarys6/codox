# JWT 认证中间件开发指南

## 📋 概述

JWT 认证中间件用于保护需要身份验证的 API 端点。它在控制器执行之前运行，验证请求中的 JWT token，并将用户信息注入到请求上下文中供后续使用。

## 🎯 功能需求

- 从 HTTP Header `Authorization: Bearer <token>` 提取 token
- 验证 token 有效性（签名、过期时间）
- 从 token 中提取 user_id
- 将 user_id 存入请求上下文，供后续控制器使用
- 未认证请求返回 401 Unauthorized

## 📁 文件结构

```.
cpp-service/src/middleware/
├── JwtAuthFilter.h    # 过滤器头文件
└── JwtAuthFilter.cc   # 过滤器实现
```

## 🔧 实现步骤

### 步骤 1：查看现有文件

首先确认 `JwtAuthFilter.h` 和 `JwtAuthFilter.cc` 已存在：

**JwtAuthFilter.h**：

```cpp
#pragma once
#include<json/json.h>
#include<drogon/drogon.h>
#include<drogon/HttpFilter.h>
#include<drogon/HttpController.h>

class JwtAuthFilter :public drogon::HttpFilter<JwtAuthFilter> {
public:
    void doFilter(const HttpRequestPtr& req,
        drogon::FilterCallback&& fcb,
        drogon::FilterChainCallback&& fccb);
};
```

### 步骤 2：实现 doFilter 方法

**JwtAuthFilter.cc 完整实现：**

```cpp
#include "JwtAuthFilter.h"
#include "../utils/JwtUtil.h"
#include <drogon/drogon.h>
#include <json/json.h>
#include <string>

void JwtAuthFilter::doFilter(const HttpRequestPtr& req,
                            drogon::FilterCallback&& fcb,
                            drogon::FilterChainCallback&& fccb) {
    // 1. 从 Header 中提取 Authorization
    std::string authHeader = req->getHeader("Authorization");
    
    // 2. 检查 Authorization header 是否存在
    if (authHeader.empty()) {
        Json::Value errorJson;
        errorJson["error"] = "Missing Authorization header";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        fcb(resp);
        return;
    }
    
    // 3. 检查格式是否为 "Bearer <token>"
    const std::string bearerPrefix = "Bearer ";
    if (authHeader.size() <= bearerPrefix.size() || 
        authHeader.substr(0, bearerPrefix.size()) != bearerPrefix) {
        Json::Value errorJson;
        errorJson["error"] = "Invalid Authorization header format. Expected: Bearer <token>";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        fcb(resp);
        return;
    }
    
    // 4. 提取 token（去除 "Bearer " 前缀）
    std::string token = authHeader.substr(bearerPrefix.size());
    
    // 5. 从配置文件获取 JWT secret
    auto& appConfig = drogon::app().getCustomConfig();
    std::string secret = appConfig.get("jwt_secret", "").asString();
    
    if (secret.empty()) {
        // 如果没有配置，使用默认值（不推荐，但为了兼容性）
        secret = "default-secret";
    }
    
    // 6. 验证 token 有效性
    if (!JwtUtil::verifyToken(token, secret)) {
        Json::Value errorJson;
        errorJson["error"] = "Invalid or expired token";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        fcb(resp);
        return;
    }
    
    // 7. 从 token 中提取 user_id
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
```

## 💻 在控制器中使用过滤器

### 注册时添加过滤器

在控制器头文件中，使用 `ADD_METHOD_TO` 的第四个参数指定过滤器：

```cpp
// UserController.h
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class UserController : public drogon::HttpController<UserController> {
public:
    METHOD_LIST_BEGIN
        // 添加 "JwtAuthFilter" 到需要认证的接口
        ADD_METHOD_TO(UserController::getMe, "/api/users/me", Get, "JwtAuthFilter");
        ADD_METHOD_TO(UserController::updateMe, "/api/users/me", Patch, "JwtAuthFilter");
        
        // 不需要认证的接口不添加过滤器
        // ADD_METHOD_TO(UserController::publicMethod, "/api/public", Get);
    METHOD_LIST_END
    
    void getMe(const HttpRequestPtr& req,
               std::function<void(const HttpResponsePtr&)>&& callback);
    
    void updateMe(const HttpRequestPtr& req,
                  std::function<void(const HttpResponsePtr&)>&& callback);
};
```

### 在控制器中获取 user_id

```cpp
// UserController.cc
#include "UserController.h"
#include <drogon/drogon.h>
#include <json/json.h>
#include <string>

void UserController::getMe(const HttpRequestPtr& req,
                           std::function<void(const HttpResponsePtr&)>&& callback) {
    // 从请求参数中获取 user_id（由过滤器设置）
    std::string userIdStr = req->getParameter("user_id");
    
    if (userIdStr.empty()) {
        // 理论上不应该发生（因为过滤器已经验证）
        Json::Value errorJson;
        errorJson["error"] = "User ID not found in request context";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k500InternalServerError);
        callback(resp);
        return;
    }
    
    int userId = std::stoi(userIdStr);
    
    // 使用 user_id 查询数据库
    auto db = drogon::app().getDbClient();
    if (!db) {
        Json::Value errorJson;
        errorJson["error"] = "Database not available";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k500InternalServerError);
        callback(resp);
        return;
    }
    
    db->execSqlAsync(
        "SELECT u.id, u.email, u.role, p.nickname, p.avatar_url "
        "FROM \"user\" u "
        "LEFT JOIN user_profile p ON u.id = p.user_id "
        "WHERE u.id = $1",
        [callback = std::move(callback)](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                // 用户不存在（理论上不应该发生）
                Json::Value errorJson;
                errorJson["error"] = "User not found";
                auto resp = HttpResponse::newHttpJsonResponse(errorJson);
                resp->setStatusCode(k404NotFound);
                callback(resp);
                return;
            }
            
            // 构建响应
            Json::Value responseJson;
            responseJson["id"] = r[0]["id"].as<int>();
            responseJson["email"] = r[0]["email"].as<std::string>();
            responseJson["role"] = r[0]["role"].as<std::string>();
            responseJson["nickname"] = r[0]["nickname"].isNull() ? 
                "" : r[0]["nickname"].as<std::string>();
            responseJson["avatar_url"] = r[0]["avatar_url"].isNull() ? 
                "" : r[0]["avatar_url"].as<std::string>();
            
            auto resp = HttpResponse::newHttpJsonResponse(responseJson);
            resp->setStatusCode(k200OK);
            callback(resp);
        },
        [callback = std::move(callback)](const drogon::orm::DrogonDbException& e) mutable {
            Json::Value errorJson;
            errorJson["error"] = "Database error: " + std::string(e.base().what());
            auto resp = HttpResponse::newHttpJsonResponse(errorJson);
            resp->setStatusCode(k500InternalServerError);
            callback(resp);
        },
        userId
    );
}
```

## 📝 编译配置

确保 `CMakeLists.txt` 包含中间件文件：

```cmake
set(ALL_SOURCES
    # ... 其他文件
    src/middleware/JwtAuthFilter.h
    src/middleware/JwtAuthFilter.cc
    # ... 其他文件
)
```

## ⚠️ 注意事项

### 1. 请求参数 vs Attributes

- **当前实现**：使用 `req->setParameter()` 和 `req->getParameter()` 存储字符串
- **优点**：简单可靠，兼容性好
- **缺点**：需要字符串和整数类型转换

如果需要直接存储整数类型，可以检查 Drogon 是否支持 `attributes()`：

```cpp
// 如果 Drogon 支持（需要检查版本）
req->attributes()->insert("user_id", userId);
```

### 2. 错误响应格式

保持与 `AuthController` 中的错误格式一致：

- 使用 JSON 格式：`{"error": "错误信息"}`
- HTTP 状态码：`401 Unauthorized` 用于认证失败

### 3. 性能考虑

- JWT 验证是同步操作，但速度很快（毫秒级）
- token 验证失败时立即返回，不继续执行后续逻辑
- 对于高并发场景，可以考虑：
  - 缓存已验证的 token（使用 Redis）
  - 使用更快的签名算法（当前使用 HS256）

### 4. 安全性

- **Token 有效期**：access_token 通常设置为 15-30 分钟
- **刷新机制**：使用 refresh_token 获取新的 access_token
- **Token 存储**：前端应该安全存储 token（避免 XSS 攻击）
- **HTTPS**：生产环境必须使用 HTTPS 传输 token

## 🧪 测试

### 测试用例 1：未提供 token

```bash
curl http://localhost:8080/api/users/me
```

**预期响应**：

```json
{
    "error": "Missing Authorization header"
}
```

状态码：`401 Unauthorized`

### 测试用例 2：无效的 token 格式

```bash
curl -H "Authorization: InvalidFormat token123" http://localhost:8080/api/users/me
```

**预期响应**：

```json
{
    "error": "Invalid Authorization header format. Expected: Bearer <token>"
}
```

### 测试用例 3：无效的 token

```bash
curl -H "Authorization: Bearer invalid.token.here" http://localhost:8080/api/users/me
```

**预期响应**：

```json
{
    "error": "Invalid or expired token"
}
```

### 测试用例 4：有效的 token

```bash
# 1. 先登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. 使用 token 访问受保护的接口
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users/me | python3 -m json.tool
```

**预期响应**：

```json
{
    "id": 1,
    "email": "test@example.com",
    "role": "viewer",
    "nickname": "",
    "avatar_url": ""
}
```

### 测试用例 5：过期的 token

如果使用已过期的 token（需要等待 access_token 过期后测试），应该返回：

```json
{
    "error": "Invalid or expired token"
}
```

## 🔍 调试技巧

### 1. 添加日志

在过滤器中添加日志输出，便于调试：

```cpp
#include <drogon/drogon.h>

void JwtAuthFilter::doFilter(...) {
    std::string authHeader = req->getHeader("Authorization");
    LOG_DEBUG << "Authorization header: " 
              << (authHeader.empty() ? "empty" : authHeader.substr(0, 20) + "...");
    
    // ... 其他代码
    
    if (!JwtUtil::verifyToken(token, secret)) {
        LOG_WARN << "JWT verification failed for token: " << token.substr(0, 20) << "...";
        // ...
    }
    
    LOG_INFO << "JWT authentication succeeded for user_id: " << userId;
    // ...
}
```

### 2. 检查配置

确认 `config.json` 中包含 JWT secret：

```json
{
    "app": {
        "jwt_secret": "your-secret-key-here",
        ...
    }
}
```

### 3. 验证 JwtUtil

如果过滤器不工作，先单独测试 `JwtUtil`：

```cpp
// 测试代码
std::string secret = "test-secret";
std::string token = JwtUtil::generateToken(123, secret, 900);
bool valid = JwtUtil::verifyToken(token, secret);
int userId = JwtUtil::getUserIdFromToken(token);
```

## 🚀 可选增强

### 1. 支持多个过滤器

可以在一个接口上注册多个过滤器，它们会按顺序执行：

```cpp
ADD_METHOD_TO(UserController::adminOnly, "/api/admin/users", Get, 
              "JwtAuthFilter", "AdminRoleFilter");
```

### 2. 缓存验证结果

对于频繁的请求，可以缓存已验证的 token（使用 Redis）：

```cpp
// 伪代码示例
std::string cacheKey = "jwt_cache:" + token;
if (redis.exists(cacheKey)) {
    // 从缓存获取 user_id
    userId = redis.get(cacheKey);
} else {
    // 验证 token
    if (JwtUtil::verifyToken(token, secret)) {
        userId = JwtUtil::getUserIdFromToken(token);
        // 缓存结果（设置较短过期时间，如 5 分钟）
        redis.setex(cacheKey, 300, userId);
    }
}
```

### 3. Token 黑名单

实现 token 撤销机制（用于登出功能）：

```cpp
// 在登出时，将 token 加入黑名单（Redis Set）
std::string blacklistKey = "jwt_blacklist";
redis.sadd(blacklistKey, token);

// 在过滤器中检查
if (redis.sismember(blacklistKey, token)) {
    // Token 已被撤销
    return 401;
}
```

### 4. 更详细的错误信息

根据不同的错误类型返回更具体的信息（注意安全性，不要泄露过多细节）：

```cpp
// 可以根据异常类型提供更具体的错误信息
try {
    auto decoded = jwt::decode(token);
    // ...
} catch (const jwt::token_verification_exception& e) {
    if (e.what() contains "expired") {
        errorJson["error"] = "Token expired";
    } else {
        errorJson["error"] = "Token verification failed";
    }
}
```

## 📚 相关文档

- [Drogon 中间件和过滤器文档](https://github.com/drogonframework/drogon/wiki/CHN-05-中间件和过滤器)
- [AuthController 开发指南](./AuthController开发指南.md)
- [第一阶段开发指南](./第一阶段开发指南.md)

## ✅ 检查清单

实现完成后，请确认：

- [ ] 过滤器能够正确提取 `Authorization` header
- [ ] 能够验证 token 的有效性（签名和过期时间）
- [ ] 能够从 token 中提取 `user_id`
- [ ] `user_id` 能够正确传递给控制器
- [ ] 各种错误情况都能返回正确的错误响应（401）
- [ ] 在 `CMakeLists.txt` 中添加了中间件文件
- [ ] 测试用例全部通过
- [ ] 日志输出正常（如果添加了日志）
