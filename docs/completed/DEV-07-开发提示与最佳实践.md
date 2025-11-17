# 开发提示与最佳实践

## 🎯 自主开发路径

### 第一步：工具类开发提示

#### JWT 工具类提示

**关键点：**

- Drogon 没有内置 JWT，你需要引入 `jwt-cpp` 库或手动实现 JWT 编码/解码
- JWT 结构：`Header.Payload.Signature`（base64url 编码）
- 推荐使用 HMAC-SHA256（HS256）算法，密钥从配置读取
- Payload 通常包含：`{"user_id": 123, "exp": <timestamp>}`

**实现思路：**

```cpp
class JwtUtils {
public:
    static std::string generateToken(int userId, const std::string& secret, int expiresIn);
    static bool verifyToken(const std::string& token, const std::string& secret);
    static int getUserIdFromToken(const std::string& token); // 解析 payload
};
```

**学习资源：**

- JWT 官方文档：<https://jwt.io/introduction>
- jwt-cpp GitHub：<https://github.com/Thalhammer/jwt-cpp>
- 如果不用库，可以用 OpenSSL 的 HMAC 函数手动实现

**常见陷阱：**

- 密钥不要硬编码，从环境变量或配置文件读取
- refresh_token 的过期时间应该比 access_token 长很多（如 30 天 vs 15 分钟）
- token 过期时间用时间戳（Unix timestamp），不是秒数

---

#### 密码工具类提示

**关键点：**

- 密码**绝对不能**明文存储，必须哈希
- 推荐使用 **BCrypt**（慢哈希，抗暴力破解）或 **Argon2**（现代推荐）
- 如果系统没有 bcrypt 库，可以用 OpenSSL 的 `EVP_BytesToKey` 或 SHA-256 + 随机盐

**实现思路：**

```cpp
class PasswordUtils {
public:
    static std::string hashPassword(const std::string& plainPassword);
    static bool verifyPassword(const std::string& plainPassword, const std::string& hash);
};
```

**BCrypt 要点：**

- BCrypt 会在哈希中自动包含盐（salt），所以相同密码每次哈希结果不同
- 验证时只需要传入明文密码和存储的哈希值即可

**如果不用 BCrypt（替代方案）：**

```cpp
// 使用 SHA-256 + 随机盐
std::string salt = generateRandomSalt(16);
std::string hash = sha256(password + salt);
// 存储格式：$sha256$salt$hash
```

**学习资源：**

- OpenSSL 文档：<https://www.openssl.org/docs/>
- BCrypt 算法原理：了解 cost factor（轮数）

---

#### 数据库工具类提示

**关键点：**

- Drogon 已经有内置的数据库连接池，直接使用即可
- 在 `config.json` 中配置数据库连接信息
- 使用 libpqxx 执行 SQL（Drogon 支持，也可以直接用 ORM）

**Drogon 数据库使用方式：**

```cpp
// 获取数据库客户端（连接池）
auto db = drogon::app().getDbClient();

// 执行查询（异步）
db->execSqlAsync(
    "SELECT * FROM \"user\" WHERE email = $1",
    [callback](const drogon::orm::Result& r) {
        // 处理结果
    },
    [callback](const drogon::Exception& e) {
        // 处理错误
    },
    email
);
```

**常见陷阱：**

- SQL 注入：**永远使用参数化查询**（`$1, $2`），不要拼接字符串
- 事务：需要事务时用 `execTransactionAsync`
- 异步回调：Drogon 的数据库操作是异步的，注意回调处理

**学习资源：**

- Drogon 数据库文档：<https://drogon.docsforge.com/>
- libpqxx 文档：<https://libpqxx.readthedocs.io/>

---

### 第二步：认证控制器开发提示

#### 注册接口 `POST /api/auth/register`

**需要做的事情：**

1. 解析请求体 JSON（`email`, `password`）
2. **验证输入**：
   - 邮箱格式（正则或简单检查 `@` 和 `.`）
   - 密码长度（建议至少 8 位）
3. 检查邮箱是否已存在（查询数据库）
4. 哈希密码
5. 插入数据库（`INSERT INTO "user" ...`）
6. 返回用户 ID 或成功消息

**Drogon 控制器示例结构：**

```cpp
class AuthController : public drogon::HttpController<AuthController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(AuthController::register, "/api/auth/register", Post);
        ADD_METHOD_TO(AuthController::login, "/api/auth/login", Post);
    METHOD_LIST_END

    void register(const HttpRequestPtr& req, 
                  std::function<void(const HttpResponsePtr&)>&& callback);
    void login(const HttpRequestPtr& req, 
               std::function<void(const HttpResponsePtr&)>&& callback);
};
```

**请求解析：**

```cpp
Json::Value json;
if (!req->jsonObject() || !req->jsonObject()->get("email", json["email"])) {
    // 返回 400 Bad Request
}
std::string email = json["email"].asString();
```

**错误处理：**

- 邮箱已存在 → 返回 409 Conflict
- 密码太短 → 返回 400 Bad Request
- 数据库错误 → 返回 500 Internal Server Error

---

#### 登录接口 `POST /api/auth/login`

**流程：**

1. 解析 `email` 和 `password`
2. 查询数据库：`SELECT id, password_hash, role FROM "user" WHERE email = $1`
3. 如果用户不存在 → 返回 401 Unauthorized
4. 验证密码（用 `PasswordUtils::verifyPassword`）
5. 如果密码错误 → 返回 401 Unauthorized
6. 生成 JWT token（access_token + refresh_token）
7. 返回 token 和用户信息

**响应格式：**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "role": "editor"
  }
}
```

---

#### 刷新 Token `POST /api/auth/refresh`

**流程：**

1. 解析 `refresh_token`
2. 验证 refresh_token 是否有效且未过期
3. 从 token 中提取 user_id
4. 生成新的 access_token（不需要新的 refresh_token）
5. 返回新的 access_token

---

### 第三步：JWT 认证中间件提示

**中间件/过滤器的作用：**

- 在控制器执行**之前**运行
- 检查请求是否有有效的 JWT token
- 如果无效 → 返回 401，不调用控制器
- 如果有效 → 解析 token，将 user_id 存入请求上下文，继续执行控制器

**Drogon 过滤器实现：**

```cpp
class JwtAuthFilter : public drogon::HttpFilter<JwtAuthFilter> {
public:
    virtual void doFilter(const HttpRequestPtr& req,
                         drogon::FilterCallback&& fcb,
                         drogon::FilterChainCallback&& fccb) override;
};
```

**关键步骤：**

1. 从 Header 提取：`Authorization: Bearer <token>`
2. 如果没有 → 返回 401
3. 验证 token（`JwtUtils::verifyToken`）
4. 解析 user_id（`JwtUtils::getUserIdFromToken`）
5. 将 user_id 存入 `req->attributes()` 或自定义上下文
6. 调用 `fccb()` 继续下一个过滤器/控制器

**在控制器中获取用户ID：**

```cpp
auto userId = req->getAttributes()->get<int>("user_id");
```

---

### 第四步：用户信息控制器开发提示

#### 获取当前用户 `GET /api/users/me`（需要认证）

**功能需求：**

- 从 JWT token 中获取当前用户 ID（通过中间件注入）
- 查询数据库获取用户信息和资料
- 返回完整的用户信息

**流程：**

1. 从请求参数中获取 `user_id`（由 `JwtAuthFilter` 设置）
2. 查询数据库：

   ```sql
   SELECT u.id, u.email, u.role, p.nickname, p.avatar_url, p.bio
   FROM "user" u
   LEFT JOIN user_profile p ON u.id = p.user_id
   WHERE u.id = $1
   ```

3. 如果用户不存在 → 返回 404 Not Found
4. 返回用户信息（包括资料）

**响应格式：**

```json
{
  "id": 123,
  "email": "user@example.com",
  "role": "viewer",
  "profile": {
    "nickname": "用户名",
    "avatar_url": "https://...",
    "bio": "个人简介"
  }
}
```

**控制器注册：**

```cpp
// UserController.h
class UserController : public drogon::HttpController<UserController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(UserController::getMe, "/api/users/me", Get, "JwtAuthFilter");
    METHOD_LIST_END
    
    void getMe(const HttpRequestPtr& req,
               std::function<void(const HttpResponsePtr&)>&& callback);
};
```

**实现示例：**

```cpp
void UserController::getMe(const HttpRequestPtr& req,
                           std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取 user_id（由过滤器设置）
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        Json::Value errorJson;
        errorJson["error"] = "Unauthorized";
        auto resp = HttpResponse::newHttpJsonResponse(errorJson);
        resp->setStatusCode(k401Unauthorized);
        callback(resp);
        return;
    }
    
    int userId = std::stoi(userIdStr);
    
    // 2. 查询数据库
    auto db = drogon::app().getDbClient();
    db->execSqlAsync(
        "SELECT u.id, u.email, u.role, p.nickname, p.avatar_url, p.bio "
        "FROM \"user\" u "
        "LEFT JOIN user_profile p ON u.id = p.user_id "
        "WHERE u.id = $1",
        [callback = std::move(callback)](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                Json::Value errorJson;
                errorJson["error"] = "User not found";
                auto resp = HttpResponse::newHttpJsonResponse(errorJson);
                resp->setStatusCode(k404NotFound);
                callback(resp);
                return;
            }
            
            Json::Value responseJson;
            responseJson["id"] = r[0]["id"].as<int>();
            responseJson["email"] = r[0]["email"].as<std::string>();
            responseJson["role"] = r[0]["role"].as<std::string>();
            
            Json::Value profileJson;
            profileJson["nickname"] = r[0]["nickname"].isNull() ? 
                "" : r[0]["nickname"].as<std::string>();
            profileJson["avatar_url"] = r[0]["avatar_url"].isNull() ? 
                "" : r[0]["avatar_url"].as<std::string>();
            profileJson["bio"] = r[0]["bio"].isNull() ? 
                "" : r[0]["bio"].as<std::string>();
            
            responseJson["profile"] = profileJson;
            
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

#### 更新用户信息 `PATCH /api/users/me`（需要认证）

**功能需求：**

- 更新当前用户的个人资料（nickname、bio 等）
- 支持部分更新（只更新提供的字段）

**流程：**

1. 获取当前用户 ID
2. 解析请求体 JSON（`nickname`、`bio` 等字段）
3. 使用 `INSERT ... ON CONFLICT DO UPDATE` 更新或插入用户资料

**SQL 示例：**

```sql
INSERT INTO user_profile (user_id, nickname, bio)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) 
DO UPDATE SET 
    nickname = COALESCE(EXCLUDED.nickname, user_profile.nickname),
    bio = COALESCE(EXCLUDED.bio, user_profile.bio),
    updated_at = NOW()
RETURNING *;
```

**请求示例：**

```json
{
  "nickname": "新昵称",
  "bio": "更新后的个人简介"
}
```

**注意事项：**

- 只更新请求中提供的字段
- 使用 `COALESCE` 确保只更新非空值
- 如果 `user_profile` 记录不存在，会自动创建

---

### 第五步：文档 CRUD 开发提示

#### 创建文档 `POST /api/docs`

**流程：**

1. 验证 JWT（中间件已做，直接获取 user_id）
2. 解析请求体：`{"title": "..."}`
3. 插入数据库：

   ```sql
   INSERT INTO document (owner_id, title) VALUES ($1, $2) RETURNING id;
   ```

4. 同时插入 ACL（owner 权限）：

   ```sql
   INSERT INTO doc_acl (doc_id, user_id, permission) VALUES ($1, $2, 'owner');
   ```

5. 返回文档信息

---

#### 权限检查思路

**文档权限规则：**

- `owner`：拥有者，可以删除、编辑、查看
- `editor`：编辑者，可以编辑、查看
- `viewer`：查看者，只能查看

**实现权限检查函数：**

```cpp
bool checkDocumentPermission(int docId, int userId, const std::string& requiredPermission) {
    auto db = drogon::app().getDbClient();
    
    // 查询用户权限
    auto result = db->execSqlSync(
        "SELECT permission FROM doc_acl WHERE doc_id = $1 AND user_id = $2",
        docId, userId
    );
    
    if (result.empty()) {
        return false; // 没有权限
    }
    
    std::string permission = result[0]["permission"].as<std::string>();
    
    // owner 可以执行所有操作
    if (permission == "owner") {
        return true;
    }
    
    // viewer 只能查看
    if (requiredPermission == "view") {
        return true;
    }
    
    // editor 可以查看和编辑，但不能删除
    if (permission == "editor" && requiredPermission == "edit") {
        return true;
    }
    
    return false;
}
```

#### 获取文档 `GET /api/docs/:id`（需要权限检查）

**流程：**

1. 从 URL 参数获取文档 ID：`req->getParameter("id")`
2. 获取当前用户 ID（从过滤器）
3. 检查用户权限（调用 `checkDocumentPermission`，`requiredPermission = "view"`）
4. 查询文档信息（包括标签、ACL 等）

**SQL 查询：**

```sql
SELECT d.id, d.title, d.owner_id, d.is_locked, d.created_at, d.updated_at,
       array_agg(t.name) as tags
FROM document d
LEFT JOIN doc_tag dt ON d.id = dt.doc_id
LEFT JOIN tag t ON dt.tag_id = t.id
WHERE d.id = $1
GROUP BY d.id
```

#### 更新文档 `PATCH /api/docs/:id`（需要权限检查）

**流程：**

1. 检查编辑权限（`requiredPermission = "edit"`）
2. 解析请求体：`{"title": "...", "is_locked": true}`
3. 更新文档（使用参数化查询）

**SQL 示例：**

```sql
UPDATE document 
SET title = COALESCE($1, title),
    is_locked = COALESCE($2, is_locked),
    updated_at = NOW()
WHERE id = $3
RETURNING *;
```

#### 删除文档 `DELETE /api/docs/:id`（需要权限检查）

**流程：**

1. 检查删除权限（只有 `owner` 可以删除）
2. 使用事务删除相关数据：
   - `doc_acl`（级联删除）
   - `doc_tag`（级联删除）
   - `document_version`（级联删除）
   - `document`（主表）

**注意：** 由于外键设置了 `ON DELETE CASCADE`，只需要删除主记录即可。

#### 文档列表 `GET /api/docs`（需要认证）

**功能需求：**

- 支持分页：`?page=1&limit=20`
- 支持筛选：`?owner_id=123`、`?tag=work`
- 只返回当前用户有权限查看的文档

**SQL 查询（带分页和筛选）：**

```sql
SELECT DISTINCT d.id, d.title, d.owner_id, d.created_at, d.updated_at
FROM document d
INNER JOIN doc_acl a ON d.id = a.doc_id AND a.user_id = $1
LEFT JOIN doc_tag dt ON d.id = dt.doc_id
LEFT JOIN tag t ON dt.tag_id = t.id
WHERE ($2::BIGINT IS NULL OR d.owner_id = $2)
  AND ($3::VARCHAR IS NULL OR t.name = $3)
ORDER BY d.updated_at DESC
LIMIT $4 OFFSET $5;
```

**响应格式：**

```json
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "docs": [
    {
      "id": 1,
      "title": "文档标题",
      "owner_id": 123,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-02T00:00:00Z"
    }
  ]
}
```

---

### 第六步：权限管理开发提示

#### ACL 权限管理

**获取文档 ACL `GET /api/docs/:id/acl`（需要认证）**

**流程：**

1. 检查用户是否有查看 ACL 的权限（通常是 owner 或 editor）
2. 查询 `doc_acl` 表，返回所有用户权限

**SQL：**

```sql
SELECT u.id, u.email, a.permission
FROM doc_acl a
INNER JOIN "user" u ON a.user_id = u.id
WHERE a.doc_id = $1;
```

#### 更新文档 ACL `PUT /api/docs/:id/acl`（需要认证）

**流程：**

1. 只有文档 owner 可以修改 ACL
2. 解析请求体：`[{"user_id": 123, "permission": "editor"}, ...]`
3. 使用事务：
   - 删除旧的 ACL（除了 owner）
   - 插入新的 ACL

**注意：**

- 不能删除 owner 的权限
- 不能将其他用户设置为 owner（只能有一个 owner）

---

### 第七步：后续功能开发提示

#### 评论系统 `POST /api/docs/:id/comments`

**数据库查询：**

```sql
-- 创建评论
INSERT INTO comment (doc_id, user_id, content, parent_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- 获取评论（树形结构）
WITH RECURSIVE comment_tree AS (
    SELECT id, user_id, content, parent_id, created_at, 0 as level
    FROM comment
    WHERE doc_id = $1 AND parent_id IS NULL
    
    UNION ALL
    
    SELECT c.id, c.user_id, c.content, c.parent_id, c.created_at, ct.level + 1
    FROM comment c
    INNER JOIN comment_tree ct ON c.parent_id = ct.id
)
SELECT * FROM comment_tree ORDER BY created_at;
```

#### 任务系统 `POST /api/docs/:id/tasks`

**创建任务：**

```sql
INSERT INTO task (doc_id, created_by, assigned_to, title, description, status, due_date)
VALUES ($1, $2, $3, $4, $5, 'pending', $6)
RETURNING *;
```

**更新任务状态：**

```sql
UPDATE task
SET status = $1, updated_at = NOW()
WHERE id = $2 AND (assigned_to = $3 OR created_by = $3)
RETURNING *;
```

#### 通知系统 `GET /api/notifications`

**查询未读通知：**

```sql
SELECT n.id, n.type, n.message, n.doc_id, n.created_at, n.is_read
FROM notification n
WHERE n.user_id = $1 AND n.is_read = false
ORDER BY n.created_at DESC
LIMIT $2 OFFSET $3;
```

**标记为已读：**

```sql
UPDATE notification
SET is_read = true, read_at = NOW()
WHERE id = $1 AND user_id = $2;
```

#### 搜索功能 `GET /api/search?q=关键词`

**基础全文搜索（PostgreSQL）：**

```sql
SELECT d.id, d.title, d.owner_id, d.updated_at,
       ts_rank(to_tsvector('english', d.title), plainto_tsquery('english', $1)) as rank
FROM document d
WHERE to_tsvector('english', d.title) @@ plainto_tsquery('english', $1)
ORDER BY rank DESC, d.updated_at DESC;
```

**如果需要更强大的搜索，建议集成 Meilisearch 或 Elasticsearch。**

---

## 🐛 常见问题与调试技巧

### 1. 编译错误

- **找不到头文件**：检查 CMakeLists.txt 的 `target_include_directories`
- **链接错误**：检查 `target_link_libraries` 是否包含所有依赖
- **未定义标识符**：检查是否添加了 `using namespace drogon;` 或使用完整命名空间

### 2. 运行时错误

- **数据库连接失败**：检查 `config.json` 的数据库配置，确认 PostgreSQL 正在运行
- **401 未授权**：检查 token 是否正确传递，格式是否为 `Bearer <token>`
- **403 禁止访问**：检查用户是否有相应的权限（ACL 权限）
- **500 服务器错误**：查看服务日志，通常是 SQL 语法错误或空指针

### 3. 调试技巧

- **打印日志**：使用 `LOG_INFO`, `LOG_ERROR`, `LOG_DEBUG` 输出关键信息
- **测试接口**：用 `curl` 或 Postman 测试每个接口
- **数据库检查**：直接用 `psql` 查询数据库，确认数据是否正确插入
- **分步调试**：将复杂逻辑拆分成多个步骤，逐步验证

### 4. 常见陷阱

- **SQL 注入**：永远使用参数化查询（`$1, $2`），不要拼接字符串
- **异步回调嵌套**：使用 `shared_ptr` 包装 callback，避免多次移动导致崩溃
- **权限检查遗漏**：每个需要权限的接口都要检查 ACL
- **空指针检查**：数据库查询结果可能为空，始终检查 `r.empty()`

---

## 📚 学习资源推荐

1. **Drogon 官方文档**：<https://drogon.docsforge.com/>
2. **libpqxx 文档**：<https://libpqxx.readthedocs.io/>
3. **JWT 原理**：<https://jwt.io/introduction>
4. **PostgreSQL SQL 教程**：<https://www.postgresql.org/docs/current/tutorial.html>

---

## ✅ 检查清单

### 基础功能检查

完成每个功能后，检查：

- [ ] 输入验证（邮箱格式、密码长度、必填字段等）
- [ ] 错误处理（用户不存在、密码错误、权限不足等）
- [ ] SQL 注入防护（使用参数化查询 `$1, $2`）
- [ ] 返回正确的 HTTP 状态码（200, 201, 400, 401, 403, 404, 500）
- [ ] 日志记录关键操作（注册、登录、权限变更等）
- [ ] 用 curl/Postman 测试接口

### 用户认证检查

- [ ] JWT token 正确生成和验证
- [ ] Token 过期时间设置合理
- [ ] Refresh token 机制正常工作
- [ ] 密码加密存储（SHA-256 + 盐）

### 权限管理检查

- [ ] ACL 权限正确查询和更新
- [ ] Owner 权限不能被删除
- [ ] 权限检查覆盖所有需要保护的接口
- [ ] 文档列表只返回用户有权限查看的文档

### 文档管理检查

- [ ] 创建文档时自动创建 ACL（owner）
- [ ] 删除文档时级联删除相关数据
- [ ] 文档列表支持分页和筛选
- [ ] 文档更新时更新 `updated_at` 时间戳

---

## 💡 进阶提示

### 代码组织

1. **异步处理**：Drogon 的数据库操作是异步的，注意回调嵌套，使用 `shared_ptr` 包装 callback 避免崩溃
2. **错误码统一**：定义统一的错误码规范，方便前端处理
3. **输入验证**：可以创建通用的验证函数，避免重复代码
4. **代码复用**：将数据库查询封装成函数，避免重复 SQL

### 性能优化

1. **数据库索引**：在常用查询字段上创建索引（如 `doc_id`, `user_id`, `email`）
2. **连接池**：合理配置 `connection_number`，根据并发量调整
3. **分页查询**：避免一次性加载大量数据，使用 `LIMIT` 和 `OFFSET`
4. **缓存**：对于频繁查询但不经常变化的数据，可以考虑使用 Redis 缓存

### 安全加固

1. **速率限制**：对登录、注册等接口添加速率限制，防止暴力破解
2. **输入过滤**：对用户输入进行清理，防止 XSS 攻击
3. **权限最小化**：默认给予最小权限，按需提升
4. **审计日志**：记录关键操作（登录、权限变更、文档删除等）

### 开发流程建议

1. **先做基础功能**：认证 → 用户管理 → 文档 CRUD → 权限管理
2. **逐步完善**：每个阶段完成后测试，确保稳定再继续
3. **编写测试**：为关键接口编写 curl 测试脚本
4. **文档同步**：及时更新 API 文档

---

## 📋 开发路线图

### 第一阶段（当前）

- [x] 用户认证（注册/登录/刷新）
- [x] JWT 中间件
- [ ] 用户信息管理
- [ ] 文档 CRUD
- [ ] 基础 ACL 权限

### 第二阶段

- [ ] 文档列表（分页/筛选）
- [ ] ACL 管理接口
- [ ] 文档标签系统
- [ ] 评论系统基础功能

### 第三阶段

- [ ] 任务管理系统
- [ ] 通知系统
- [ ] 全文搜索（PostgreSQL 全文搜索或集成 Meilisearch）
- [ ] 文档版本管理

### 第四阶段（可选）

- [ ] 实时协作对接（Yjs WebSocket）
- [ ] 文档导入导出
- [ ] 高级权限管理
- [ ] 审计日志系统

---

## 🚀 开始吧

按照这个提示，一步步实现。遇到具体问题时：

1. 先查看错误信息
2. 查阅相关文档（Drogon、PostgreSQL、JWT）
3. 搜索类似问题（Stack Overflow、GitHub Issues）
4. 如果还是卡住，再来问我具体的问题

**记住：自己解决问题是最快的成长方式！** 💪

---

## 📝 代码示例索引

- **JWT 工具类**：参考 `src/utils/JwtUtil.h/cc`
- **密码工具类**：参考 `src/utils/PasswordUtils.h/cc`
- **认证控制器**：参考 `src/controllers/AuthController.h/cc`和 [AuthController开发指南]
- **JWT 中间件**：参考 `src/middleware/JwtAuthFilter.h/cc` 和 [JWT认证中间件开发指南](./JWT认证中间件开发指南.md)
- **用户控制器**：参考 `src/controllers/UserController.h/cc` 和 [UserController开发指南](./UserController开发指南.md)
