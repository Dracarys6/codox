# CollaborationController 详解

## 📋 概述

`CollaborationController` 是负责处理实时协作编辑相关请求的控制器。它作为业务后端（C++）与协作服务（y-websocket）之间的桥梁，负责：

1. **权限验证**：确保用户有权限访问文档
2. **令牌管理**：生成用于连接 WebSocket 的临时令牌
3. **快照管理**：处理文档快照的保存和加载
4. **版本控制**：将协作编辑的内容持久化为文档版本

## 🏗️ 架构位置

```
前端 (React + Tiptap + Yjs)
    ↓ WebSocket 连接（需要 token）
协作服务 (y-websocket, 端口 1234)
    ↓ HTTP API 调用
CollaborationController (C++ 后端, 端口 8080)
    ↓ 数据库操作
PostgreSQL (文档元数据、版本信息)
    ↓ 对象存储
MinIO/S3 (文档快照文件)
```

## 🔑 三个核心函数详解

### 1. `getToken` - 获取协作令牌

**路由**: `POST /api/collab/token`  
**认证**: 需要 JWT Token（通过 JwtAuthFilter）  
**作用**: 为前端生成一个临时令牌，用于连接 WebSocket 协作服务

#### 工作流程

```
1. 前端请求 → POST /api/collab/token
   {
     "doc_id": 123
   }

2. 后端验证：
   - 从 JWT 中间件获取 user_id
   - 检查用户是否有该文档的 viewer 或更高权限

3. 生成临时令牌：
   - 包含 doc_id、user_id、type="collab"
   - 有效期 1 小时（3600 秒）

4. 返回令牌：
   {
     "token": "eyJhbGci...",
     "expiresIn": 3600
   }

5. 前端使用令牌连接 WebSocket：
   ws://localhost:1234?docId=123&token=eyJhbGci...
```

#### 代码逻辑

```cpp
void CollaborationController::getToken(...) {
    // 1. 获取用户 ID（从 JWT 中间件）
    int userId = std::stoi(req->getParameter("user_id"));
    
    // 2. 解析请求体，获取文档 ID
    int docId = json["doc_id"].asInt();
    
    // 3. 检查权限（至少需要 viewer 权限）
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            // 返回 403 Forbidden
            return;
        }
        
        // 4. 生成临时 JWT 令牌
        Json::Value payload;
        payload["doc_id"] = docId;
        payload["user_id"] = userId;
        payload["type"] = "collab";
        
        // 从配置获取 JWT secret
        auto& appConfig = drogon::app().getCustomConfig();
        std::string secret = appConfig.get("jwt_secret", "default-secret").asString();
        
        std::string token = JwtUtil::generateToken(payload, secret, 3600);
        
        // 5. 返回令牌
        responseJson["token"] = token;
        responseJson["expiresIn"] = 3600;
    });
}
```

#### 安全考虑

- ✅ **权限验证**：只有有权限的用户才能获取令牌
- ✅ **短期有效**：令牌只有 1 小时有效期，降低泄露风险
- ✅ **文档绑定**：令牌包含 doc_id，只能用于访问指定文档
- ✅ **用户绑定**：令牌包含 user_id，防止令牌被其他用户使用

---

### 2. `getBootstrap` - 获取引导快照

**路由**: `GET /api/collab/bootstrap/{id}`  
**认证**: 需要 JWT Token  
**作用**: 获取文档的最新发布版本快照，用于初始化 Yjs 文档

#### 工作流程

```
1. 前端请求 → GET /api/collab/bootstrap/123

2. 后端验证：
   - 检查用户权限（至少 viewer）

3. 查询数据库：
   - 查找文档的最新发布版本（last_published_version_id）
   - 获取快照 URL、SHA256 哈希、版本 ID

4. 返回快照信息：
   {
     "snapshot_url": "https://minio.example.com/snapshots/doc-123-v5.json",
     "sha256": "abc123...",
     "version_id": 5
   }

5. 前端加载快照：
   - 从 snapshot_url 下载快照文件
   - 使用 Y.applyUpdate() 将快照应用到 Yjs 文档
   - 然后连接 WebSocket 进行实时同步
```

#### 为什么需要引导快照？

- **离线恢复**：用户重新打开文档时，需要加载之前保存的内容
- **版本一致性**：确保所有用户从同一个版本开始编辑
- **性能优化**：避免通过 WebSocket 传输大量历史数据

#### 代码逻辑

```cpp
void CollaborationController::getBootstrap(...) {
    // 1. 获取文档 ID 和用户 ID
    int docId = std::stoi(routingParams[0]);
    int userId = std::stoi(req->getParameter("user_id"));
    
    // 2. 检查权限
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        // 3. 查询最新发布版本
        db->execSqlAsync(
            "SELECT dv.snapshot_url, dv.snapshot_sha256, dv.id as version_id "
            "FROM document d "
            "LEFT JOIN document_version dv ON d.last_published_version_id = dv.id "
            "WHERE d.id = $1::integer",
            [=](const Result& r) {
                if (r.empty() || r[0]["snapshot_url"].isNull()) {
                    // 没有快照，返回空（新文档）
                    responseJson["snapshot_url"] = Json::Value::null;
                } else {
                    // 返回快照信息
                    responseJson["snapshot_url"] = r[0]["snapshot_url"].as<std::string>();
                    responseJson["sha256"] = r[0]["snapshot_sha256"].as<std::string>();
                    responseJson["version_id"] = r[0]["version_id"].as<int>();
                }
            }
        );
    });
}
```

#### 特殊情况处理

- **新文档**：如果没有发布过版本，返回 `null`，前端从空文档开始
- **权限不足**：返回 403 Forbidden
- **文档不存在**：数据库查询返回空，前端需要处理

---

### 3. `handleSnapshot` - 处理快照回调

**路由**: `POST /api/collab/snapshot/{id}`  
**认证**: 使用 Webhook Token（不是 JWT）  
**作用**: 接收协作服务发送的快照，保存为文档版本

#### 工作流程

```
1. 协作服务定期保存快照（每 30 秒）：
   - Yjs 文档状态序列化为二进制
   - 上传到 MinIO/S3
   - 计算 SHA256 哈希

2. 协作服务回调 → POST /api/collab/snapshot/123
   Headers: X-Webhook-Token: your_webhook_token_here
   Body: {
     "snapshot_url": "https://minio.../doc-123-snapshot-20240101.bin",
     "sha256": "abc123...",
     "size_bytes": 10240
   }

3. 后端验证：
   - 验证 Webhook Token（防止未授权调用）
   - 检查是否已存在相同 SHA256 的版本（幂等性）

4. 保存版本：
   - 如果不存在，插入新版本记录
   - 更新文档的 last_published_version_id
   - 返回版本 ID

5. 返回结果：
   {
     "version_id": 6,
     "message": "Snapshot saved successfully"
   }
```

#### 为什么需要快照回调？

- **持久化**：将内存中的 Yjs 文档状态保存到数据库
- **版本管理**：每次快照保存为一个版本，支持版本回滚
- **容错恢复**：服务重启后可以从快照恢复文档状态

#### 代码逻辑

```cpp
void CollaborationController::handleSnapshot(...) {
    // 1. 验证 Webhook Token（安全验证）
    std::string webhookToken = req->getHeader("X-Webhook-Token");
    if (webhookToken != expectedToken) {
        return 401 Unauthorized;
    }
    
    // 2. 获取文档 ID 和快照信息
    int docId = std::stoi(routingParams[0]);
    std::string snapshotUrl = json["snapshot_url"].asString();
    std::string sha256 = json["sha256"].asString();
    int64_t sizeBytes = json["size_bytes"].asInt64();
    
    // 3. 检查是否已存在（幂等性）
    db->execSqlAsync(
        "SELECT id FROM document_version WHERE doc_id = $1 AND snapshot_sha256 = $2",
        [=](const Result& r) {
            if (!r.empty()) {
                // 已存在，直接返回现有版本 ID
                return;
            }
            
            // 4. 插入新版本记录
            db->execSqlAsync(
                "INSERT INTO document_version (doc_id, snapshot_url, snapshot_sha256, size_bytes, created_by) "
                "VALUES ($1, $2, $3, $4, 0) RETURNING id",
                [=](const Result& r) {
                    int versionId = r[0]["id"].as<int>();
                    
                    // 5. 更新文档的最新发布版本
                    db->execSqlAsync(
                        "UPDATE document SET last_published_version_id = $1 WHERE id = $2",
                        [=](const Result&) {
                            // 返回成功
                        }
                    );
                }
            );
        }
    );
}
```

#### 幂等性设计

- **SHA256 去重**：相同内容的快照只保存一次，避免重复版本
- **重试安全**：如果网络问题导致回调失败，可以安全重试
- **资源节约**：避免存储重复的快照文件

#### 安全考虑

- ✅ **Webhook Token**：只有知道密钥的服务才能调用
- ✅ **文档 ID 验证**：确保快照属于正确的文档
- ✅ **SHA256 校验**：确保快照内容完整性

---

## 🔄 完整协作流程

### 用户打开文档并开始编辑

```
1. 前端加载文档页面
   ↓
2. 调用 getBootstrap(docId)
   - 获取最新快照 URL
   - 下载并加载到 Yjs 文档
   ↓
3. 调用 getToken(docId)
   - 获取临时令牌
   ↓
4. 连接 WebSocket
   ws://localhost:1234?docId=123&token=xxx
   ↓
5. 开始实时协作编辑
   - 多个用户同时编辑
   - Yjs 自动合并冲突
   - 实时同步到所有客户端
   ↓
6. 协作服务定期保存快照（每 30 秒）
   - 序列化 Yjs 文档
   - 上传到 MinIO
   - 调用 handleSnapshot 保存版本
   ↓
7. 用户关闭页面
   - WebSocket 断开
   - 最后一次快照已保存
```

### 用户重新打开文档

```
1. 前端加载文档页面
   ↓
2. 调用 getBootstrap(docId)
   - 获取最新快照（包含上次编辑的内容）
   - 加载到 Yjs 文档
   ↓
3. 继续从上次保存的状态开始编辑
```

---

## 📊 数据流图

```
┌─────────────┐
│   前端       │
│  (React)     │
└──────┬───────┘
       │ 1. getBootstrap (获取快照)
       │ 2. getToken (获取令牌)
       │ 3. WebSocket 连接
       │
       ▼
┌─────────────┐
│ 协作服务     │
│(y-websocket)│
└──────┬───────┘
       │ 4. 定期保存快照
       │ 5. handleSnapshot (回调)
       │
       ▼
┌─────────────┐
│ Collaboration│
│  Controller  │
└──────┬───────┘
       │
       ├──→ PostgreSQL (版本元数据)
       │
       └──→ MinIO/S3 (快照文件)
```

---

## 🛡️ 安全机制

### 1. 权限控制

- **getToken**: 需要文档的 viewer 权限
- **getBootstrap**: 需要文档的 viewer 权限
- **handleSnapshot**: 使用 Webhook Token（服务间认证）

### 2. 令牌安全

- **短期有效**：协作令牌只有 1 小时有效期
- **文档绑定**：令牌只能用于访问指定文档
- **用户绑定**：令牌包含用户 ID，防止滥用

### 3. 数据完整性

- **SHA256 校验**：确保快照内容未被篡改
- **幂等性**：相同内容的快照只保存一次

---

## 🔧 配置要求

在 `cpp-service/config.json` 中需要配置：

```json
{
  "app": {
    "webhook_token": "your_webhook_token_here",
    "minio_endpoint": "localhost:9000",
    "minio_access_key": "minioadmin",
    "minio_secret_key": "minioadmin",
    "minio_bucket": "documents"
  }
}
```

---

## 📝 总结

`CollaborationController` 是实时协作系统的核心组件，它：

1. **getToken**: 为前端提供安全的 WebSocket 连接凭证
2. **getBootstrap**: 提供文档的初始状态，支持离线恢复
3. **handleSnapshot**: 将协作编辑的内容持久化为版本

这三个函数共同实现了：
- ✅ 安全的协作接入
- ✅ 版本管理和历史记录
- ✅ 离线编辑和恢复
- ✅ 多人实时同步

---

**相关文档**：
- [第三阶段开发指南](./第三阶段开发指南.md)
- [详细设计文档](./详细设计.md)

