# UserController 开发指南

## 📋 概述

用户信息控制器（UserController）提供当前登录用户信息的查询和更新功能。所有接口都需要 JWT 认证，通过 `JwtAuthFilter` 中间件验证。

## 🎯 功能需求

### 接口列表

1. **GET /api/users/me** - 获取当前用户信息
2. **PATCH /api/users/me** - 更新当前用户信息

## 📁 文件结构

```.
cpp-service/src/controllers/
├── UserController.h    # 控制器头文件
└── UserController.cc   # 控制器实现
```

## 🔧 实现步骤

### 步骤 1：控制器头文件 (UserController.h)

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class UserController : public drogon::HttpController<UserController> {
public:
    METHOD_LIST_BEGIN
        // 获取当前用户信息（需要认证）
        ADD_METHOD_TO(UserController::getMe, "/api/users/me", Get, "JwtAuthFilter");
        // 更新当前用户信息（需要认证）
        ADD_METHOD_TO(UserController::updateMe, "/api/users/me", Patch, "JwtAuthFilter");
    METHOD_LIST_END

    void getMe(const HttpRequestPtr& req,
               std::function<void(const HttpResponsePtr&)>&& callback);

    void updateMe(const HttpRequestPtr& req,
                  std::function<void(const HttpResponsePtr&)>&& callback);

private:
    // 辅助方法：格式化错误响应
    void sendError(const std::function<void(const HttpResponsePtr&)>& callback,
                   const std::string& message,
                   int statusCode);

    // 辅助方法：格式化成功响应
    void sendSuccess(const std::function<void(const HttpResponsePtr&)>& callback,
                     const Json::Value& data,
                     int statusCode = k200OK);
};
```

### 步骤 2：获取当前用户信息 `GET /api/users/me`

#### 功能说明

从 JWT token 中获取当前用户 ID，查询数据库返回完整的用户信息，包括基本信息和用户资料。

#### 实现流程

1. **获取用户 ID**：从请求参数中获取 `user_id`（由 `JwtAuthFilter` 设置）
2. **验证用户 ID**：确保用户 ID 存在且有效
3. **查询数据库**：查询用户表和用户资料表的关联数据
4. **构建响应**：格式化返回 JSON 响应

#### 完整实现代码

```cpp
#include "UserController.h"
#include <drogon/drogon.h>
#include <json/json.h>
#include <string>
#include <sstream>
#include <memory>

void UserController::getMe(const HttpRequestPtr& req,
                           std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取 user_id（由 JwtAuthFilter 设置）
    std::string userIdStr = req->getParameter("user_id");
    
    if (userIdStr.empty()) {
        sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }

    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (const std::exception& e) {
        sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 2. 获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    // 使用 shared_ptr 包装 callback 以支持异步调用
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 3. 查询用户信息和资料（注意 SQL 中要有空格）
    db->execSqlAsync(
        "SELECT u.id, u.email, u.role, u.created_at, u.updated_at, "
        "       p.nickname, p.avatar_url, p.bio "
        "FROM \"user\" u "
        "LEFT JOIN user_profile p ON u.id = p.user_id "
        "WHERE u.id = $1",
        [=](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                sendError(*callbackPtr, "User not found", k404NotFound);
                return;
            }

            // 4. 构建响应 JSON
            Json::Value responseJson;
            
            // 基本信息
            responseJson["id"] = r[0]["id"].as<int>();
            responseJson["email"] = r[0]["email"].as<std::string>();
            responseJson["role"] = r[0]["role"].as<std::string>();
            
            // 时间戳（可选，根据需求决定是否返回）
            // responseJson["created_at"] = r[0]["created_at"].as<std::string>();
            // responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();

            // 用户资料（嵌套对象）
            Json::Value profileJson;
            profileJson["nickname"] = r[0]["nickname"].isNull() ? 
                "" : r[0]["nickname"].as<std::string>();
            profileJson["avatar_url"] = r[0]["avatar_url"].isNull() ? 
                "" : r[0]["avatar_url"].as<std::string>();
            profileJson["bio"] = r[0]["bio"].isNull() ? 
                "" : r[0]["bio"].as<std::string>();
            
            responseJson["profile"] = profileJson;

            sendSuccess(*callbackPtr, responseJson);
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        userId
    );
}
```

#### 响应格式

**成功响应 (200 OK)：**

```json
{
    "id": 123,
    "email": "user@example.com",
    "role": "viewer",
    "profile": {
        "nickname": "用户名",
        "avatar_url": "https://example.com/avatar.jpg",
        "bio": "个人简介"
    }
}
```

**错误响应：**

- `401 Unauthorized`：用户未认证或 user_id 缺失
- `404 Not Found`：用户不存在
- `500 Internal Server Error`：数据库错误

### 步骤 3：更新当前用户信息 `PATCH /api/users/me`

#### 1.功能说明

更新当前用户的个人资料信息（nickname、bio、avatar_url）。支持部分更新，只更新请求中提供的字段。

#### 2.实现流程

1. **获取用户 ID**：从请求参数中获取当前用户 ID
2. **解析请求体**：从 JSON 中提取要更新的字段
3. **验证输入**：检查字段长度、格式等
4. **更新数据库**：使用 `INSERT ... ON CONFLICT DO UPDATE` 实现 upsert
5. **返回更新后的信息**

#### 3.完整实现代码

```cpp
void UserController::updateMe(const HttpRequestPtr& req,
                              std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    
    if (userIdStr.empty()) {
        sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }

    int userId;
    try {
        userId = std::stoi(userIdStr);
    } catch (const std::exception& e) {
        sendError(callback, "Invalid user ID", k400BadRequest);
        return;
    }

    // 2. 解析请求体 JSON
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    
    // 提取要更新的字段
    std::string nickname = json.get("nickname", "").asString();
    std::string bio = json.get("bio", "").asString();
    std::string avatarUrl = json.get("avatar_url", "").asString();

    // 3. 输入验证
    if (nickname.length() > 64) {
        sendError(callback, "Nickname too long (max 64 characters)", k400BadRequest);
        return;
    }

    if (bio.length() > 500) {  // 假设 bio 最大长度为 500
        sendError(callback, "Bio too long (max 500 characters)", k400BadRequest);
        return;
    }

    // 4. 获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 5. 更新或插入用户资料
    // 使用 COALESCE 实现部分更新：如果新值为空字符串，保持原值不变
    // 注意：PostgreSQL 的 COALESCE 在这里用于处理 NULL，但我们需要处理空字符串
    // 更好的方式是：只更新提供的字段（非空字符串）
    
    // 方案 1：如果字段为空字符串，使用 NULL（表示不更新该字段）
    db->execSqlAsync(
        "INSERT INTO user_profile (user_id, nickname, avatar_url, bio) "
        "VALUES ($1, "
        "        CASE WHEN $2 = '' THEN NULL ELSE $2 END, "
        "        CASE WHEN $3 = '' THEN NULL ELSE $3 END, "
        "        CASE WHEN $4 = '' THEN NULL ELSE $4 END) "
        "ON CONFLICT (user_id) "
        "DO UPDATE SET "
        "    nickname = COALESCE(EXCLUDED.nickname, user_profile.nickname), "
        "    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profile.avatar_url), "
        "    bio = COALESCE(EXCLUDED.bio, user_profile.bio) "
        "RETURNING *",
        [=, userId](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                sendError(*callbackPtr, "Failed to update profile", k500InternalServerError);
                return;
            }

            // 6. 重新查询完整的用户信息（包括基本信息和资料）
            auto db2 = drogon::app().getDbClient();
            db2->execSqlAsync(
                "SELECT u.id, u.email, u.role, "
                "       p.nickname, p.avatar_url, p.bio "
                "FROM \"user\" u "
                "LEFT JOIN user_profile p ON u.id = p.user_id "
                "WHERE u.id = $1",
                [=](const drogon::orm::Result& r2) mutable {
                    if (r2.empty()) {
                        sendError(*callbackPtr, "User not found", k404NotFound);
                        return;
                    }

                    Json::Value responseJson;
                    responseJson["id"] = r2[0]["id"].as<int>();
                    responseJson["email"] = r2[0]["email"].as<std::string>();
                    responseJson["role"] = r2[0]["role"].as<std::string>();

                    Json::Value profileJson;
                    profileJson["nickname"] = r2[0]["nickname"].isNull() ? 
                        "" : r2[0]["nickname"].as<std::string>();
                    profileJson["avatar_url"] = r2[0]["avatar_url"].isNull() ? 
                        "" : r2[0]["avatar_url"].as<std::string>();
                    profileJson["bio"] = r2[0]["bio"].isNull() ? 
                        "" : r2[0]["bio"].as<std::string>();

                    responseJson["profile"] = profileJson;

                    sendSuccess(*callbackPtr, responseJson);
                },
                [=](const drogon::orm::DrogonDbException& e) mutable {
                    sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                userId
            );
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        userId,
        nickname.empty() ? std::string() : nickname,
        avatarUrl.empty() ? std::string() : avatarUrl,
        bio.empty() ? std::string() : bio
    );
}
```

#### 优化版本（只更新提供的字段）

更优雅的实现方式是：只更新请求体中明确提供的字段（不包括空字符串）。

```cpp
void UserController::updateMe(const HttpRequestPtr& req,
                              std::function<void(const HttpResponsePtr&)>&& callback) {
    // ... (前面的代码相同)

    // 检查哪些字段需要更新（请求中存在且不为空）
    bool updateNickname = json.isMember("nickname") && !nickname.empty();
    bool updateAvatarUrl = json.isMember("avatar_url") && !avatarUrl.empty();
    bool updateBio = json.isMember("bio") && !bio.empty();

    // 如果没有任何字段需要更新
    if (!updateNickname && !updateAvatarUrl && !updateBio) {
        sendError(callback, "No valid fields to update", k400BadRequest);
        return;
    }

    // 构建动态 SQL（根据提供的字段）
    std::string sql = "INSERT INTO user_profile (user_id";
    std::vector<std::string> values = {std::to_string(userId)};
    std::vector<std::string> updates;
    int paramIndex = 2;

    if (updateNickname) {
        sql += ", nickname";
        values.push_back("$" + std::to_string(paramIndex++));
        updates.push_back("nickname = EXCLUDED.nickname");
    }
    if (updateAvatarUrl) {
        sql += ", avatar_url";
        values.push_back("$" + std::to_string(paramIndex++));
        updates.push_back("avatar_url = EXCLUDED.avatar_url");
    }
    if (updateBio) {
        sql += ", bio";
        values.push_back("$" + std::to_string(paramIndex++));
        updates.push_back("bio = EXCLUDED.bio");
    }

    sql += ") VALUES ($1";
    for (size_t i = 1; i < values.size(); i++) {
        sql += ", " + values[i];
    }
    sql += ") ON CONFLICT (user_id) DO UPDATE SET ";
    sql += updates[0];
    for (size_t i = 1; i < updates.size(); i++) {
        sql += ", " + updates[i];
    }

    // ... (执行 SQL 查询)
}
```

**简单版本（推荐）：**

对于当前阶段，建议使用简单版本：接受所有字段，空字符串表示清空字段。

```cpp
void UserController::updateMe(const HttpRequestPtr& req,
                              std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取 user_id（同上）
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }

    int userId = std::stoi(userIdStr);

    // 2. 解析 JSON（同上）
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }

    Json::Value json = *jsonPtr;
    std::string nickname = json.get("nickname", "").asString();
    std::string bio = json.get("bio", "").asString();
    std::string avatarUrl = json.get("avatar_url", "").asString();

    // 3. 验证（同上）
    if (nickname.length() > 64) {
        sendError(callback, "Nickname too long", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 4. Upsert 用户资料
    // 注意：空字符串会被存储，表示清空该字段
    db->execSqlAsync(
        "INSERT INTO user_profile (user_id, nickname, avatar_url, bio) "
        "VALUES ($1, $2, $3, $4) "
        "ON CONFLICT (user_id) "
        "DO UPDATE SET "
        "    nickname = $2, "
        "    avatar_url = $3, "
        "    bio = $4 "
        "RETURNING user_id",
        [=, userId, nickname, avatarUrl, bio](const drogon::orm::Result& r) mutable {
            // 重新查询完整信息
            auto db2 = drogon::app().getDbClient();
            db2->execSqlAsync(
                "SELECT u.id, u.email, u.role, p.nickname, p.avatar_url, p.bio "
                "FROM \"user\" u "
                "LEFT JOIN user_profile p ON u.id = p.user_id "
                "WHERE u.id = $1",
                [=](const drogon::orm::Result& r2) mutable {
                    if (r2.empty()) {
                        sendError(*callbackPtr, "User not found", k404NotFound);
                        return;
                    }

                    Json::Value responseJson;
                    responseJson["id"] = r2[0]["id"].as<int>();
                    responseJson["email"] = r2[0]["email"].as<std::string>();
                    responseJson["role"] = r2[0]["role"].as<std::string>();

                    Json::Value profileJson;
                    profileJson["nickname"] = r2[0]["nickname"].isNull() ? 
                        "" : r2[0]["nickname"].as<std::string>();
                    profileJson["avatar_url"] = r2[0]["avatar_url"].isNull() ? 
                        "" : r2[0]["avatar_url"].as<std::string>();
                    profileJson["bio"] = r2[0]["bio"].isNull() ? 
                        "" : r2[0]["bio"].as<std::string>();

                    responseJson["profile"] = profileJson;
                    sendSuccess(*callbackPtr, responseJson);
                },
                [=](const drogon::orm::DrogonDbException& e) mutable {
                    sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                userId
            );
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        userId,
        nickname,
        avatarUrl,
        bio
    );
}
```

#### 请求格式

**请求示例：**

```json
{
    "nickname": "新昵称",
    "bio": "更新后的个人简介",
    "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**部分更新（只更新 nickname）：**

```json
{
    "nickname": "新昵称"
}
```

#### 响应格式

**成功响应 (200 OK)：**

```json
{
    "id": 123,
    "email": "user@example.com",
    "role": "viewer",
    "profile": {
        "nickname": "新昵称",
        "avatar_url": "https://example.com/new-avatar.jpg",
        "bio": "更新后的个人简介"
    }
}
```

**错误响应：**

- `400 Bad Request`：无效的 JSON、字段过长
- `401 Unauthorized`：用户未认证
- `500 Internal Server Error`：数据库错误

### 步骤 4：辅助方法实现

```cpp
void UserController::sendError(
    const std::function<void(const HttpResponsePtr&)>& callback,
    const std::string& message,
    int statusCode) {
    
    Json::Value errorJson;
    errorJson["error"] = message;
    auto resp = HttpResponse::newHttpJsonResponse(errorJson);
    resp->setStatusCode(static_cast<HttpStatusCode>(statusCode));
    callback(resp);
}

void UserController::sendSuccess(
    const std::function<void(const HttpResponsePtr&)>& callback,
    const Json::Value& data,
    int statusCode) {
    
    // 格式化 JSON 输出（与 AuthController 保持一致）
    Json::StreamWriterBuilder builder;
    builder["indentation"] = "  ";
    builder["commentStyle"] = "None";
    builder["enableYAMLCompatibility"] = false;
    builder["dropNullPlaceholders"] = false;
    builder["useSpecialFloats"] = false;
    builder["precision"] = 17;

    std::unique_ptr<Json::StreamWriter> writer(builder.newStreamWriter());
    std::ostringstream os;
    writer->write(data, &os);

    auto resp = HttpResponse::newHttpResponse();
    resp->setBody(os.str());
    resp->setContentTypeCode(CT_APPLICATION_JSON);
    resp->setStatusCode(static_cast<HttpStatusCode>(statusCode));
    callback(resp);
}
```

### 步骤 5：更新 CMakeLists.txt

确保 `CMakeLists.txt` 包含 UserController 文件：

```cmake
set(ALL_SOURCES
    # ... 其他文件
    src/controllers/UserController.h
    src/controllers/UserController.cc
    # ... 其他文件
)
```

## ⚠️ 注意事项

### 1. SQL 语句格式

**常见错误：** SQL 语句中缺少空格导致语法错误

```cpp
// ❌ 错误：缺少空格
"SELECT u.id,u.email,u.role,p.nickname"
"FROM \"user\" u"

// ✅ 正确：字段之间有空格
"SELECT u.id, u.email, u.role, p.nickname "
"FROM \"user\" u "
```

### 2. NULL 值处理

当 `LEFT JOIN` 的结果可能为 NULL 时，使用 `isNull()` 检查：

```cpp
profileJson["nickname"] = r[0]["nickname"].isNull() ? 
    "" : r[0]["nickname"].as<std::string>();
```

### 3. 回调函数管理

使用 `shared_ptr` 包装 callback，避免嵌套异步调用时多次移动导致崩溃：

```cpp
auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
```

### 4. 部分更新策略

选择一种策略并保持一致：

- **策略 A**：空字符串表示清空字段（当前实现）
- **策略 B**：只更新请求中提供的字段，忽略空字符串
- **策略 C**：使用 `null` 表示不更新该字段

### 5. 输入验证

- **nickname**：长度限制（建议 1-64 字符）
- **bio**：长度限制（建议最大 500-1000 字符）
- **avatar_url**：URL 格式验证（可选）

## 🧪 测试

### 测试用例 1：获取用户信息（未认证）

```bash
curl http://localhost:8080/api/users/me
```

**预期响应：** `401 Unauthorized`

### 测试用例 2：获取用户信息（已认证）

```bash
# 1. 先登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. 获取用户信息
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users/me | python3 -m json.tool
```

**预期响应：** 返回完整的用户信息

### 测试用例 3：更新用户信息

```bash
curl -X PATCH http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "新昵称",
    "bio": "这是我的个人简介"
  }' | python3 -m json.tool
```

**预期响应：** 返回更新后的用户信息

### 测试用例 4：部分更新

```bash
curl -X PATCH http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname": "只更新昵称"}' | python3 -m json.tool
```

**预期响应：** 只更新 nickname，其他字段保持不变

### 测试用例 5：无效输入

```bash
# 字段过长
curl -X PATCH http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname": "'$(python3 -c "print('a'*100)")'"}' | python3 -m json.tool
```

**预期响应：** `400 Bad Request` - "Nickname too long"

## 🔍 调试技巧

### 1. 检查 user_id 是否正确传递

```cpp
LOG_DEBUG << "User ID from request: " << userIdStr;
```

### 2. 打印 SQL 查询结果

```cpp
LOG_DEBUG << "Query result size: " << r.size();
if (!r.empty()) {
    LOG_DEBUG << "User email: " << r[0]["email"].as<std::string>();
}
```

### 3. 验证 JSON 解析

```cpp
LOG_DEBUG << "JSON received: " << json.toStyledString();
```

## 🚀 可选增强功能

### 1. 添加头像上传接口

如果后续需要支持头像上传，可以添加：

```cpp
ADD_METHOD_TO(UserController::uploadAvatar, "/api/users/me/avatar", Post, "JwtAuthFilter");
```

### 2. 添加用户统计信息

在响应中返回用户创建的文档数、评论数等：

```sql
SELECT 
    COUNT(DISTINCT d.id) as doc_count,
    COUNT(DISTINCT c.id) as comment_count
FROM "user" u
LEFT JOIN document d ON u.id = d.owner_id
LEFT JOIN comment c ON u.id = c.author_id
WHERE u.id = $1
GROUP BY u.id
```

### 3. 添加用户偏好设置

扩展 `user_profile` 表，添加偏好设置字段，如：

- `theme`（主题设置）
- `language`（语言设置）
- `notification_preferences`（通知偏好，JSONB 类型）

## 📚 相关文档

- [JWT认证中间件开发指南](./JWT认证中间件开发指南.md)
- [AuthController开发指南](./AuthController开发指南.md)
- [第一阶段开发指南](./第一阶段开发指南.md)
- [开发提示与最佳实践](./开发提示与最佳实践.md)

## ✅ 检查清单

实现完成后，请确认：

- [ ] `GET /api/users/me` 返回正确的用户信息
- [ ] `PATCH /api/users/me` 能够更新用户资料
- [ ] 支持部分更新（只更新提供的字段）
- [ ] 输入验证正确（字段长度限制）
- [ ] NULL 值处理正确（LEFT JOIN）
- [ ] 错误处理完整（401、404、500）
- [ ] SQL 语句中有正确的空格
- [ ] 回调函数使用 `shared_ptr` 包装
- [ ] 响应格式与其他接口一致
- [ ] 所有测试用例通过
