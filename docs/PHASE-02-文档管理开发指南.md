# 第二阶段开发指南：文档 CRUD、权限管理与版本控制

## 🎯 第二阶段目标

完成文档的完整 CRUD 操作、基于 ACL 的权限管理，以及文档版本管理功能。

---

## 📋 开发步骤

### 步骤 1：创建 DocumentController（优先级：高）

创建 `src/controllers/DocumentController.h` 和 `DocumentController.cc`

#### 1.1 控制器结构

```cpp
// DocumentController.h
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class DocumentController : public drogon::HttpController<DocumentController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(DocumentController::create, "/api/docs", Post, "JwtAuthFilter");
        ADD_METHOD_TO(DocumentController::list, "/api/docs", Get, "JwtAuthFilter");
        ADD_METHOD_TO(DocumentController::getById, "/api/docs/{id}", Get, "JwtAuthFilter");
        ADD_METHOD_TO(DocumentController::update, "/api/docs/{id}", Patch, "JwtAuthFilter");
        ADD_METHOD_TO(DocumentController::deleteDoc, "/api/docs/{id}", Delete, "JwtAuthFilter");
    METHOD_LIST_END

    void create(const HttpRequestPtr& req,
                std::function<void(const HttpResponsePtr&)>&& callback);
    
    void list(const HttpRequestPtr& req,
              std::function<void(const HttpResponsePtr&)>&& callback);
    
    void getById(const HttpRequestPtr& req,
                 std::function<void(const HttpResponsePtr&)>&& callback);
    
    void update(const HttpRequestPtr& req,
                std::function<void(const HttpResponsePtr&)>&& callback);
    
    void deleteDoc(const HttpRequestPtr& req,
                   std::function<void(const HttpResponsePtr&)>&& callback);
};
```

---

### 步骤 2：实现文档 CRUD 接口

#### 2.1 创建文档 `POST /api/docs`

**功能需求：**

- 创建新文档，设置 owner_id 为当前用户
- 支持可选标签（tags）
- 自动创建 owner ACL 记录

**请求体：**

```json
{
  "title": "文档标题",
  "tags": ["tag1", "tag2"]  // 可选
}
```

**实现步骤：**

1. 从 JWT 中间件获取 `user_id`
2. 验证标题（非空，长度限制）
3. 开启事务：
   - 插入 `document` 表
   - 插入 `doc_acl` 表（owner 权限）
   - 处理标签（插入或关联到 `tag` 和 `doc_tag` 表）
4. 返回文档信息

**SQL 示例：**

```sql
-- 插入文档
INSERT INTO document (owner_id, title)
VALUES ($1::integer, $2)
RETURNING id, owner_id, title, created_at, updated_at;

-- 插入 ACL（owner）
INSERT INTO doc_acl (doc_id, user_id, permission)
VALUES ($1::integer, $2::integer, 'owner');

-- 处理标签（如果提供）
-- 先查找或创建标签
INSERT INTO tag (name) VALUES ($1)
ON CONFLICT (name) DO NOTHING
RETURNING id;

-- 关联文档和标签
INSERT INTO doc_tag (doc_id, tag_id)
VALUES ($1::integer, $2::integer)
ON CONFLICT DO NOTHING;
```

**响应格式：**

```json
{
  "id": 1,
  "title": "文档标题",
  "owner_id": 123,
  "is_locked": false,
  "tags": ["tag1", "tag2"],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

#### 2.2 获取文档列表 `GET /api/docs`

**功能需求：**

- 支持分页（page, pageSize）
- 支持筛选：tag、author（owner_id）
- 只返回用户有权限查看的文档（owner 或 ACL 中存在）

**查询参数：**

- `page`：页码（默认 1）
- `pageSize`：每页数量（默认 20，最大 100）
- `tag`：标签筛选（可选）
- `author`：作者筛选（owner_id，可选）

**实现步骤：**

1. 从 JWT 获取 `user_id`
2. 解析查询参数
3. 构建 SQL 查询（JOIN doc_acl 和 doc_tag）
4. 返回文档列表和总数

**SQL 示例：**

```sql
-- 基础查询（用户有权限的文档）
SELECT DISTINCT d.id, d.title, d.owner_id, d.is_locked, 
       d.created_at, d.updated_at
FROM document d
LEFT JOIN doc_acl a ON d.id = a.doc_id
WHERE d.owner_id = $1::integer  -- 用户是 owner
   OR a.user_id = $1::integer   -- 用户在 ACL 中
   
-- 如果指定了 tag
AND EXISTS (
    SELECT 1 FROM doc_tag dt
    JOIN tag t ON dt.tag_id = t.id
    WHERE dt.doc_id = d.id AND t.name = $2
)

-- 如果指定了 author
AND d.owner_id = $3::integer

ORDER BY d.updated_at DESC
LIMIT $4 OFFSET $5;
```

**响应格式：**

```json
{
  "docs": [
    {
      "id": 1,
      "title": "文档标题",
      "owner_id": 123,
      "tags": ["tag1"],
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

---

#### 2.3 获取文档详情 `GET /api/docs/:id`

**功能需求：**

- 检查用户是否有查看权限（owner 或 ACL viewer/editor/owner）
- 返回文档完整信息（包括标签）

**实现步骤：**

1. 从路径参数获取 `doc_id`：`req->getParameter("id")`
2. 从 JWT 获取 `user_id`：`req->getParameter("user_id")`（由中间件设置）
3. 检查权限（调用权限检查函数）
4. 查询文档信息和标签
5. 返回结果

**路径参数获取示例：**

```cpp
void DocumentController::getById(const HttpRequestPtr& req, ...) {
    // 获取路径参数 {id}
    std::string docIdStr = req->getParameter("id");
    if (docIdStr.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    
    int docId = std::stoi(docIdStr);
    
    // 获取 user_id（由 JwtAuthFilter 设置）
    std::string userIdStr = req->getParameter("user_id");
    int userId = std::stoi(userIdStr);
    
    // 继续处理...
}
```

**权限检查 SQL：**

```sql
-- 检查用户是否有权限查看文档
SELECT permission FROM doc_acl
WHERE doc_id = $1::integer AND user_id = $2::integer

UNION ALL

-- 如果是 owner，也返回 owner 权限
SELECT 'owner'::VARCHAR(16) as permission
FROM document
WHERE id = $1::integer AND owner_id = $2::integer
LIMIT 1;
```

**查询文档 SQL：**

```sql
SELECT d.id, d.title, d.owner_id, d.is_locked, 
       d.last_published_version_id,
       d.created_at, d.updated_at,
       COALESCE(
           json_agg(json_build_object('id', t.id, 'name', t.name)) 
           FILTER (WHERE t.id IS NOT NULL),
           '[]'::json
       ) as tags
FROM document d
LEFT JOIN doc_tag dt ON d.id = dt.doc_id
LEFT JOIN tag t ON dt.tag_id = t.id
WHERE d.id = $1::integer
GROUP BY d.id;
```

**响应格式：**

```json
{
  "id": 1,
  "title": "文档标题",
  "owner_id": 123,
  "is_locked": false,
  "last_published_version_id": 5,
  "tags": [
    {"id": 1, "name": "tag1"},
    {"id": 2, "name": "tag2"}
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

#### 2.4 更新文档 `PATCH /api/docs/:id`

**功能需求：**

- 检查用户是否有编辑权限（owner 或 ACL editor/owner）
- 支持更新标题、is_locked 状态
- 支持更新标签

**请求体：**

```json
{
  "title": "新标题",      // 可选
  "is_locked": false,    // 可选
  "tags": ["tag1", "tag3"]  // 可选，替换所有标签
}
```

**实现步骤：**

1. 检查权限（owner 或 editor）
2. 更新文档字段（如果提供）
3. 更新标签（如果提供）：
   - 删除旧的 doc_tag 关联
   - 插入新的标签关联
4. 返回更新后的文档

**SQL 示例：**

```sql
-- 更新文档
UPDATE document
SET title = COALESCE($2, title),
    is_locked = COALESCE($3, is_locked),
    updated_at = NOW()
WHERE id = $1::integer
RETURNING *;

-- 更新标签（先删除旧关联）
DELETE FROM doc_tag WHERE doc_id = $1::integer;

-- 插入新标签关联
INSERT INTO doc_tag (doc_id, tag_id)
SELECT $1::integer, id FROM tag WHERE name = ANY($2::VARCHAR[]);
```

**错误响应：**

- `403 Forbidden`：用户没有编辑权限
- `404 Not Found`：文档不存在

---

#### 2.5 删除文档 `DELETE /api/docs/:id`

**功能需求：**

- 只有 owner 可以删除文档
- 级联删除相关数据（ACL、标签关联、版本等）

**实现步骤：**

1. 检查权限（必须是 owner）
2. 删除文档（数据库外键会级联删除相关记录）
3. 返回 204 No Content

**SQL 示例：**

```sql
-- 检查是否是 owner
SELECT owner_id FROM document WHERE id = $1::integer;

-- 删除文档（级联删除 doc_acl, doc_tag, document_version 等）
DELETE FROM document WHERE id = $1::integer AND owner_id = $2::integer;
```

**响应：**

- `204 No Content`：删除成功
- `403 Forbidden`：不是 owner
- `404 Not Found`：文档不存在

---

### 步骤 3：实现权限检查工具函数

创建 `src/utils/PermissionUtils.h` 和 `PermissionUtils.cc`

**功能：**

- 检查用户对文档的权限
- 返回权限级别（owner/editor/viewer/none）

**函数签名：**

```cpp
// PermissionUtils.h
#pragma once
#include <string>
#include <functional>
#include <drogon/drogon.h>

class PermissionUtils {
public:
    // 检查用户权限，返回 owner/editor/viewer/none
    static void checkPermission(
        int docId,
        int userId,
        std::function<void(const std::string&)> successCallback,
        std::function<void(const std::string&)> errorCallback
    );
    
    // 同步版本（用于简单场景）
    static std::string checkPermissionSync(int docId, int userId);
    
    // 检查是否有指定权限
    static void hasPermission(
        int docId,
        int userId,
        const std::string& requiredPermission,  // owner/editor/viewer
        std::function<void(bool)> callback
    );
};
```

**实现示例：**

```cpp
// PermissionUtils.cc
#include "PermissionUtils.h"
#include <drogon/drogon.h>

void PermissionUtils::checkPermission(
    int docId,
    int userId,
    std::function<void(const std::string&)> successCallback,
    std::function<void(const std::string&)> errorCallback
) {
    auto db = drogon::app().getDbClient();
    if (!db) {
        errorCallback("Database not available");
        return;
    }
    
    // 查询权限（owner 或 ACL）
    db->execSqlAsync(
        "SELECT COALESCE(MAX(permission), 'none') as permission "
        "FROM ("
        "  SELECT permission FROM doc_acl "
        "  WHERE doc_id = $1::integer AND user_id = $2::integer "
        "  UNION ALL "
        "  SELECT 'owner'::VARCHAR(16) FROM document "
        "  WHERE id = $1::integer AND owner_id = $2::integer"
        ") perm",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                successCallback("none");
                return;
            }
            successCallback(r[0]["permission"].as<std::string>());
        },
        [=](const drogon::orm::DrogonDbException& e) {
            errorCallback(std::string(e.base().what()));
        },
        std::to_string(docId),
        std::to_string(userId)
    );
}
```

---

### 步骤 4：实现 ACL 管理接口

在 `DocumentController` 中添加 ACL 相关方法：

#### 4.1 获取文档 ACL `GET /api/docs/:id/acl`

**功能：**

- 只有 owner 可以查看 ACL
- 返回文档的所有 ACL 记录

**实现：**

```cpp
void DocumentController::getAcl(const HttpRequestPtr& req,
                                 std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取 doc_id 和 user_id
    // 2. 检查是否是 owner
    // 3. 查询 doc_acl 表
    // 4. 返回 ACL 列表
}
```

**SQL：**

```sql
SELECT user_id, permission
FROM doc_acl
WHERE doc_id = $1::integer
ORDER BY user_id;
```

**响应：**

```json
{
  "doc_id": 1,
  "acl": [
    {
      "user_id": 1,
      "permission": "owner"
    },
    {
      "user_id": 2,
      "permission": "editor"
    },
    {
      "user_id": 3,
      "permission": "viewer"
    }
  ]
}
```

---

#### 4.2 设置文档 ACL `PUT /api/docs/:id/acl`

**功能：**

- 只有 owner 可以设置 ACL
- 替换所有 ACL 记录（先删除旧的，再插入新的）
- 不允许删除 owner 的 ACL

**请求体：**

```json
{
  "acl": [
    {
      "user_id": 2,
      "permission": "editor"
    },
    {
      "user_id": 3,
      "permission": "viewer"
    }
  ]
}
```

**实现步骤：**

1. 验证是否是 owner
2. 验证请求体（user_id 必须存在，permission 必须是 owner/editor/viewer）
3. 确保 owner 的 ACL 不会被删除
4. 事务操作：
   - 删除旧的 ACL（保留 owner）
   - 插入新的 ACL
5. 返回更新后的 ACL

**SQL：**

```sql
-- 删除旧的 ACL（保留 owner）
DELETE FROM doc_acl
WHERE doc_id = $1::integer
  AND permission != 'owner';

-- 插入新的 ACL（批量插入）
INSERT INTO doc_acl (doc_id, user_id, permission)
VALUES ($1::integer, $2::integer, $3),
       ($1::integer, $4::integer, $5)
ON CONFLICT (doc_id, user_id) DO UPDATE
SET permission = EXCLUDED.permission;
```

---

### 步骤 5：实现版本管理接口

#### 5.1 发布版本 `POST /api/docs/:id/publish`

**功能：**

- 只有 owner 或 editor 可以发布版本
- 创建新的 document_version 记录
- 更新 document.last_published_version_id

**请求体：**

```json
{
  "snapshot_url": "https://minio.example.com/snapshots/doc1-v1.json",
  "sha256": "abc123...",
  "size_bytes": 1024
}
```

**实现步骤：**

1. 检查权限（owner 或 editor）
2. 插入 document_version 记录
3. 更新 document.last_published_version_id
4. 返回版本信息

**SQL：**

```sql
-- 插入版本记录
INSERT INTO document_version (doc_id, snapshot_url, snapshot_sha256, size_bytes, created_by)
VALUES ($1::integer, $2, $3, $4::bigint, $5::integer)
RETURNING id, doc_id, snapshot_url, created_at;

-- 更新文档的 last_published_version_id
UPDATE document
SET last_published_version_id = $1::bigint,
    updated_at = NOW()
WHERE id = $2::integer;
```

**响应：**

```json
{
  "version_id": 5,
  "doc_id": 1,
  "snapshot_url": "https://...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

#### 5.2 获取版本列表 `GET /api/docs/:id/versions`

**功能：**

- 检查用户查看权限
- 返回文档的所有版本列表

**实现：**

```cpp
void DocumentController::getVersions(const HttpRequestPtr& req,
                                     std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 检查权限
    // 2. 查询 document_version 表
    // 3. 返回版本列表
}
```

**SQL：**

```sql
SELECT id, doc_id, snapshot_url, snapshot_sha256, size_bytes,
       created_by, created_at
FROM document_version
WHERE doc_id = $1::integer
ORDER BY created_at DESC;
```

**响应：**

```json
{
  "versions": [
    {
      "id": 5,
      "doc_id": 1,
      "snapshot_url": "https://...",
      "sha256": "abc123...",
      "size_bytes": 1024,
      "created_by": 123,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### 5.3 版本回滚 `POST /api/docs/:id/rollback/:versionId`

**功能：**

- 只有 owner 可以回滚
- 将指定版本设为当前版本（更新 last_published_version_id）
- 可选：更新快照内容（需要协作服务支持）

**实现步骤：**

1. 检查权限（必须是 owner）
2. 验证版本是否存在且属于该文档
3. 更新 document.last_published_version_id
4. 返回成功

**SQL：**

```sql
-- 验证版本存在且属于文档
SELECT id FROM document_version
WHERE id = $1::integer AND doc_id = $2::integer;

-- 更新文档版本
UPDATE document
SET last_published_version_id = $1::bigint,
    updated_at = NOW()
WHERE id = $2::integer;
```

**响应：**

```json
{
  "message": "Version rolled back successfully",
  "version_id": 5,
  "doc_id": 1
}
```

---

## 🛠️ 技术实现要点

### 权限检查逻辑

**权限优先级：**

1. `owner`：拥有者，最高权限（创建、查看、编辑、删除、管理 ACL）
2. `editor`：编辑者（创建、查看、编辑）
3. `viewer`：查看者（仅查看）
4. `none`：无权限

**权限检查函数：**

```cpp
// 在控制器中使用
void DocumentController::update(const HttpRequestPtr& req, ...) {
    // 获取路径参数 {id}
    std::string docIdStr = req->getParameter("id");
    int docId = std::stoi(docIdStr);
    
    // 获取 user_id（由 JwtAuthFilter 设置）
    std::string userIdStr = req->getParameter("user_id");
    int userId = std::stoi(userIdStr);
    
    PermissionUtils::hasPermission(
        docId, userId, "editor",
        [=](bool hasPermission) {
            if (!hasPermission) {
                ResponseUtils::sendError(callback, "Forbidden", k403Forbidden);
                return;
            }
            // 继续更新逻辑
        }
    );
}
```

### 事务处理

**使用 Drogon 的事务：**

```cpp
auto db = drogon::app().getDbClient();
auto transPtr = std::make_shared<drogon::orm::Transaction>(db);

db->execSqlAsync(
    "BEGIN",
    [=](const drogon::orm::Result& r) {
        // 第一个操作
        db->execSqlAsync(
            "INSERT INTO ...",
            [=](const drogon::orm::Result& r2) {
                // 第二个操作
                db->execSqlAsync(
                    "COMMIT",
                    [=](const drogon::orm::Result& r3) {
                        // 成功回调
                    },
                    [=](const drogon::orm::DrogonDbException& e) {
                        // 回滚
                        db->execSqlAsync("ROLLBACK", ...);
                    }
                );
            },
            [=](const drogon::orm::DrogonDbException& e) {
                db->execSqlAsync("ROLLBACK", ...);
            }
        );
    },
    [=](const drogon::orm::DrogonDbException& e) {
        // 错误处理
    }
);
```

### 参数绑定注意事项

**整数参数绑定：**

```cpp
// ✅ 正确：转换为字符串并使用 $1::integer
db->execSqlAsync(
    "SELECT * FROM document WHERE id = $1::integer",
    ...,
    std::to_string(docId)
);

// ❌ 错误：直接传递整数
db->execSqlAsync(
    "SELECT * FROM document WHERE id = $1",
    ...,
    docId  // 可能导致 "insufficient data left in message" 错误
);
```

---

## 📝 开发顺序建议

1. ✅ **创建 PermissionUtils**（权限检查工具）
2. 📄 **实现 DocumentController.create**（创建文档）
3. 📄 **实现 DocumentController.getById**（获取文档详情）
4. 📄 **实现 DocumentController.list**（文档列表）
5. 📄 **实现 DocumentController.update**（更新文档）
6. 📄 **实现 DocumentController.deleteDoc**（删除文档）
7. 🔒 **实现 ACL 管理接口**（获取/设置 ACL）
8. 📌 **实现版本管理接口**（发布/列表/回滚）

**每一步完成后立即测试！**

---

## ✅ 测试建议

**提示**：以下示例使用 HTTPie，语法更简洁易读。

### 测试创建文档

```bash
# 1. 先登录获取 token
TOKEN=$(http POST http://localhost:8080/api/auth/login \
  account=test@example.com \
  password=test12345 | jq -r '.access_token')

# 2. 创建文档（JSON 数组使用 := 语法）
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  title=测试文档 \
  tags:='["test","demo"]'
```

### 测试获取文档列表

```bash
http GET http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  page==1 \
  pageSize==20
```

### 测试获取文档详情

```bash
http GET http://localhost:8080/api/docs/1 \
  Authorization:"Bearer $TOKEN"
```

### 测试更新文档

```bash
http PATCH http://localhost:8080/api/docs/1 \
  Authorization:"Bearer $TOKEN" \
  title=更新后的标题 \
  is_locked:=true
```

### 测试设置 ACL

```bash
# 设置 ACL（JSON 对象数组）
http PUT http://localhost:8080/api/docs/1/acl \
  Authorization:"Bearer $TOKEN" \
  acl:='[{"user_id":2,"permission":"editor"},{"user_id":3,"permission":"viewer"}]'
```

### 测试发布版本

```bash
http POST http://localhost:8080/api/docs/1/publish \
  Authorization:"Bearer $TOKEN" \
  snapshot_url=https://minio.example.com/snapshots/doc1-v1.json \
  sha256=abc123def456... \
  size_bytes:=1024
```

### 测试获取 ACL

```bash
http GET http://localhost:8080/api/docs/1/acl \
  Authorization:"Bearer $TOKEN"
```

### 测试获取版本列表

```bash
http GET http://localhost:8080/api/docs/1/versions \
  Authorization:"Bearer $TOKEN"
```

### 测试版本回滚

```bash
http POST http://localhost:8080/api/docs/1/rollback/5 \
  Authorization:"Bearer $TOKEN"
```

---

## 🚀 开始开发

建议从 **PermissionUtils** 开始，然后实现 **创建文档** 接口，逐步迭代！

**关键提示：**

- 每个接口完成后立即测试
- 注意权限检查的正确性
- 使用事务确保数据一致性
- 整数参数记得转换为字符串并使用 `$1::integer`

**参考文档：**

- [详细设计文档](./详细设计.md) - API 规格和数据库设计
- [开发提示与最佳实践](./开发提示与最佳实践.md) - 开发规范和最佳实践
- [后端 API 测试方法](./后端API测试方法.md) - API 测试方法
