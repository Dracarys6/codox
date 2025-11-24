# 详细设计文档

> **文档状态（2025-11-24）**
> - 作用：提供数据库、接口、配置、部署的细粒度说明，是研发与运维协作的主文档。
> - 最近更新：补充版本控制链路（HTML 存储 + Diff 兼容）、协作自动保存 60s 以及通知/聊天等第四阶段实现。
> - 关联：总体思路见 `ARCH-01`，接口使用规范可对照 `API-01`，阶段执行参考 `PHASE-04`。

本文档描述多人在线协作编辑系统的详细技术实现，包括数据库设计、API 规格、代码结构、配置说明和部署指南。

## 目录

1. [数据库设计](#数据库设计)
2. [API 设计](#api-设计)
3. [代码结构](#代码结构)
4. [配置说明](#配置说明)
5. [构建与运行](#构建与运行)
6. [关键流程](#关键流程)
7. [错误码规范](#错误码规范)
8. [安全实现](#安全实现)
9. [部署指南](#部署指南)

---

## 数据库设计

### 数据库模型（PostgreSQL 方言，兼容 openGauss）

```sql
-- 用户与角色
CREATE TABLE "user" (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'viewer', -- admin/editor/viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_profile (
  user_id BIGINT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  nickname VARCHAR(64),
  avatar_url TEXT,
  bio TEXT
);

-- 文档与访问控制
CREATE TABLE document (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES "user"(id),
  title VARCHAR(255) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  last_published_version_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doc_acl (
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL, -- owner/editor/viewer
  PRIMARY KEY (doc_id, user_id)
);

-- 文档版本（快照元数据 + 存储位置）
CREATE TABLE document_version (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  snapshot_url TEXT NOT NULL,
  snapshot_sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 标签
CREATE TABLE tag (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL
);

CREATE TABLE doc_tag (
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (doc_id, tag_id)
);

-- 评论
CREATE TABLE comment (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES "user"(id),
  anchor JSONB,
  content TEXT NOT NULL,
  parent_id BIGINT REFERENCES comment(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 任务
CREATE TABLE task (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  assignee_id BIGINT REFERENCES "user"(id),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'todo', -- todo/doing/done
  due_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 通知
CREATE TABLE notification (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 实时通讯
CREATE TABLE chat_room (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(20) NOT NULL,         -- direct / group / document
  doc_id BIGINT REFERENCES document(id) ON DELETE SET NULL,
  created_by BIGINT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_room_member (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES chat_room(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

CREATE TABLE chat_message (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES chat_room(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES "user"(id),
  content TEXT,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  file_url TEXT,
  reply_to BIGINT REFERENCES chat_message(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_message_read (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES chat_message(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- 通知偏好
CREATE TABLE notification_setting (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

-- 用户行为聚合（用于运营分析，按需开启）
CREATE TABLE user_activity_daily (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  login_count INTEGER DEFAULT 0,
  edit_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  task_updates INTEGER DEFAULT 0,
  UNIQUE(user_id, activity_date)
);

-- 索引
CREATE INDEX idx_document_owner_updated ON document(owner_id, updated_at DESC);
CREATE INDEX idx_doc_tag_tag ON doc_tag(tag_id);
CREATE INDEX idx_comment_doc_created ON comment(doc_id, created_at DESC);
CREATE INDEX idx_task_doc_status ON task(doc_id, status);
CREATE INDEX idx_notification_user_created ON notification(user_id, created_at DESC);
CREATE INDEX idx_chat_room_member ON chat_room_member(room_id, user_id);
CREATE INDEX idx_chat_message_room_created ON chat_message(room_id, created_at DESC);
CREATE INDEX idx_notification_setting_user_type ON notification_setting(user_id, notification_type);
CREATE INDEX idx_user_activity_daily_date ON user_activity_daily(activity_date);
```

### 设计要点

- **文档正文不入库**：采用"快照对象存储（MinIO/S3）+ 元数据入库"的模式，便于大文档与版本化
- **版本管理**：通过 `document_version` 表管理快照元数据，快照文件存储在对象存储中
- **权限控制**：通过 `doc_acl` 表实现文档级权限控制，结合系统角色（RBAC）实现双重权限体系
- **全文检索**：由索引服务（Meilisearch）维护可检索文本

---

## API 设计

### 认证相关 API

#### 用户注册

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "nickname": "用户名"  // 可选
}
```

**响应** (201 Created)：

```json
{
  "id": 1,
  "email": "user@example.com"
}
```

**错误响应**：

- `400 Bad Request`：邮箱格式错误、密码长度不足、邮箱已存在
- `500 Internal Server Error`：数据库错误

#### 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "account": "user@example.com",  // 支持邮箱或手机号
  "password": "password123"
}
```

**响应** (200 OK)：

```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "viewer",
    "nickname": "用户名",
    "avatar_url": ""
  }
}
```

#### 刷新 Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGci..."
}
```

**响应** (200 OK)：

```json
{
  "access_token": "eyJhbGci..."
}
```

### 用户相关 API

#### 获取当前用户信息

```http
GET /api/users/me
Authorization: Bearer <access_token>
```

**响应** (200 OK)：

```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "viewer",
  "profile": {
    "nickname": "用户名",
    "avatar_url": "",
    "bio": "个人简介"
  }
}
```

#### 更新当前用户信息

```http
PATCH /api/users/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "nickname": "新昵称",
  "bio": "新简介",
  "avatar_url": "https://..."
}
```

### 文档相关 API

#### 创建文档

```http
POST /api/docs
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "文档标题",
  "tags": ["tag1", "tag2"]  // 可选
}
```

**响应** (201 Created)：

```json
{
  "id": 1,
  "title": "文档标题",
  "owner_id": 1,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### 获取文档列表

```http
GET /api/docs?page=1&pageSize=20&tag=tag1&author=1
Authorization: Bearer <access_token>
```

**响应** (200 OK)：

```json
{
  "docs": [
    {
      "id": 1,
      "title": "文档标题",
      "owner_id": 1,
      "tags": ["tag1"],
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

#### 获取文档详情

```http
GET /api/docs/:id
Authorization: Bearer <access_token>
```

#### 更新文档

```http
PATCH /api/docs/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "新标题",
  "is_locked": false
}
```

#### 删除文档

```http
DELETE /api/docs/:id
Authorization: Bearer <access_token>
```

### 权限相关 API

#### 获取文档 ACL

```http
GET /api/docs/:id/acl
Authorization: Bearer <access_token>
```

**响应** (200 OK)：

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
    }
  ]
}
```

#### 设置文档 ACL

```http
PUT /api/docs/:id/acl
Authorization: Bearer <access_token>
Content-Type: application/json

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

### 版本相关 API

#### 发布版本

```http
POST /api/docs/:id/publish
Authorization: Bearer <access_token>
```

#### 获取版本列表

```http
GET /api/docs/:id/versions
Authorization: Bearer <access_token>
```

#### 版本回滚

```http
POST /api/docs/:id/rollback/:versionId
Authorization: Bearer <access_token>
```

### 协作相关 API

#### 获取协作令牌

```http
POST /api/collab/token
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "doc_id": 1
}
```

**响应** (200 OK)：

```json
{
  "token": "one-time-jwt-token",
  "expiresIn": 3600
}
```

#### 获取引导快照

```http
GET /api/collab/bootstrap/:docId
Authorization: Bearer <access_token>
```

**响应** (200 OK)：

```json
{
  "snapshot_url": "https://...",
  "sha256": "abc123...",
  "version_id": 5
}
```

#### 快照回调（Webhook）

```http
POST /api/collab/snapshot/:docId
Content-Type: application/json
X-Webhook-Token: <webhook_secret>

{
  "snapshot_url": "https://...",
  "sha256": "abc123...",
  "size_bytes": 1024
}
```

### 评论相关 API

#### 获取评论列表

```http
GET /api/docs/:id/comments
Authorization: Bearer <access_token>
```

#### 创建评论

```http
POST /api/docs/:id/comments
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "anchor": {"from": 10, "to": 20},
  "content": "评论内容",
  "parent_id": null  // 可选，回复评论时使用
}
```

#### 删除评论

```http
DELETE /api/comments/:id
Authorization: Bearer <access_token>
```

### 任务相关 API

#### 获取任务列表

```http
GET /api/docs/:id/tasks
Authorization: Bearer <access_token>
```

#### 创建任务

```http
POST /api/docs/:id/tasks
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "任务标题",
  "assignee_id": 2,
  "due_at": "2024-12-31T23:59:59Z"
}
```

#### 更新任务状态

```http
PATCH /api/tasks/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "doing"  // todo/doing/done
}
```

### 通知相关 API

#### 获取通知列表

```http
GET /api/notifications?page=1&page_size=20&unread_only=true
Authorization: Bearer <access_token>
```

**响应** (200 OK)：

```json
{
  "notifications": [
    {
      "id": 1,
      "type": "comment",
      "payload": {
        "doc_id": 1,
        "comment_id": 5,
        "author_id": 2
      },
      "is_read": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 20
}
```

#### 标记通知为已读

```http
POST /api/notifications/read
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "notification_ids": [1, 2, 3]
}
```

**响应** (200 OK)：

```json
{
  "message": "Notifications marked as read"
}
```

#### 获取未读通知数量

```http
GET /api/notifications/unread-count
Authorization: Bearer <access_token>
```

**响应** (200 OK)：

```json
{
  "unread_count": 5
}
```

### 实时通讯 API

#### 创建聊天室

```http
POST /api/chat/rooms
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "项目 A 讨论",
  "type": "document",        // direct | group | document
  "doc_id": 42,
  "member_ids": [2, 3, 4]
}
```

- 验证调用者权限；文档型聊天室会校验 `doc_acl`
- 自动将创建者加入 `chat_room_member`

#### 获取聊天室列表

```http
GET /api/chat/rooms?page=1&page_size=20
Authorization: Bearer <access_token>
```

响应包含 last_message、last_message_time、unread_count。

#### 发送消息

```http
POST /api/chat/rooms/{id}/messages
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "今晚 8 点上线",
  "message_type": "text",
  "reply_to": 123
}
```

- 支持文件消息（`file_url` 字段，复用 MinIO）
- 成功后返回消息 ID、时间戳、回执

#### 获取消息历史 / 游标分页

```http
GET /api/chat/rooms/{id}/messages?page=1&page_size=50&before_id=456
Authorization: Bearer <access_token>
```

- 验证调用者在聊天室内
- `before_id` 提供游标翻页

#### 标记消息已读

```http
POST /api/chat/messages/{id}/read
Authorization: Bearer <access_token>
```

- 更新 `chat_message_read` 与成员 `last_read_at`
- 失败不影响主流程

#### WebSocket 协议（collab-service）

- `ws://<collab-service>/chat?room_id=xx&token=yy`
- 支持事件：`join`、`message`、`typing`、`read`
- 通过 HTTP API 完成持久化，再广播给房间成员

### 通知增强 & 偏好设置 API

#### 带过滤条件的通知列表

```http
GET /api/notifications?type=comment&doc_id=18&unread_only=true&start_date=2025-11-01
Authorization: Bearer <access_token>
```

#### 通知偏好

```http
GET /api/notification-settings
Authorization: Bearer <access_token>

PUT /api/notification-settings/{type}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email_enabled": true,
  "push_enabled": false,
  "in_app_enabled": true
}
```

- `notification_type` 例如 `comment`, `task_assigned`, `permission_changed`
- 后端在发送通知时读取设置并决定投递渠道

### 文档导入导出 API（规划）

| Endpoint | 方法 | 说明 |
| -------- | ---- | ---- |
| `/api/documents/import/word` | POST (multipart) | 上传 Word，转换为内部格式后创建文档 |
| `/api/documents/import/pdf` | POST (multipart) | 上传 PDF，提取文本/图片 |
| `/api/documents/import/markdown` | POST (multipart) | 上传 Markdown，转换为 ProseMirror JSON |
| `/api/documents/{id}/export/word` | GET | 基于最新快照导出 Word |
| `/api/documents/{id}/export/pdf` | GET | 导出 PDF |
| `/api/documents/{id}/export/markdown` | GET | 导出 Markdown |

- 后端可内嵌转换库或通过 `doc-converter-service`（Node.js）桥接
- 导入成功后记录版本信息与导入来源

### 管理员 / 用户运营 API（规划）

#### 用户列表

```http
GET /api/admin/users?role=editor&status=active&keyword=alice&page=1&page_size=20
Authorization: Bearer <admin_token>
```

返回字段：基本信息、角色、最近登录、文档数量、是否锁定等。

#### 权限调整

```http
POST /api/admin/users/{id}/roles
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "roles": ["editor", "collab_manager"]
}
```

所有变更写入审计日志。

#### 用户行为分析

```http
GET /api/admin/user-analytics?from=2025-11-01&to=2025-11-30&dimension=team
Authorization: Bearer <admin_token>
```

数据来源 `user_activity_daily`，用于生成活跃度、编辑次数等图表。

#### 满意度 / 反馈收集

```http
POST /api/feedback
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "dimension": "editor_experience",
  "score": 4,
  "comment": "希望增加夜间模式"
}
```

管理员可通过 `GET /api/feedback/stat` 查看统计。


### 搜索相关 API

#### 全文搜索

```http
GET /api/search?q=关键词&author=1&tag=tag1&from=2024-01-01&to=2024-12-31
Authorization: Bearer <access_token>
```

**响应** (200 OK)：

```json
{
  "hits": [
    {
      "id": 1,
      "title": "文档标题",
      "content": "文档内容...",
      "_formatted": {
        "title": "文档<em>标题</em>",
        "content": "...<em>关键词</em>..."
      }
    }
  ],
  "query": "关键词",
  "page": 1,
  "page_size": 20,
  "total_hits": 10
}
```

**注意**：搜索结果会根据用户权限进行过滤，只返回用户有权限访问的文档。

---

## 代码结构

### 目录结构建议

```目录
cpp-service/
├── src/
│   ├── main.cpp                    # 程序入口
│   ├── controllers/                # API 控制器
│   │   ├── AuthController.h/cc    # 认证相关 API
│   │   ├── HealthController.h/cc  # 健康检查
│   │   ├── UserController.h/cc   # 用户相关 API
│   │   ├── DocumentController.h/cc # 文档相关 API
│   │   ├── CollaborationController.h/cc # 协作相关 API
│   │   ├── CommentController.h/cc # 评论相关 API
│   │   ├── TaskController.h/cc   # 任务相关 API
│   │   ├── NotificationController.h/cc # 通知相关 API
│   │   └── SearchController.h/cc # 搜索相关 API
│   ├── middleware/                 # 中间件/过滤器
│   │   └── JwtAuthFilter.h/cc     # JWT 认证过滤器
│   ├── services/                   # 业务逻辑层
│   │   ├── AuthService.h/cc
│   │   ├── DocumentService.h/cc
│   │   └── SearchService.h/cc
│   ├── repositories/               # 数据访问层
│   │   ├── UserRepository.h/cc
│   │   ├── DocumentRepository.h/cc
│   │   └── VersionRepository.h/cc
│   ├── models/                     # 数据模型
│   │   ├── User.h
│   │   └── Document.h
│   └── utils/                       # 工具类
│       ├── JwtUtil.h/cc            # JWT 工具
│       ├── PasswordUtils.h/cc      # 密码加密工具
│       ├── ResponseUtils.h/cc      # 响应工具
│       ├── PermissionUtils.h/cc    # 权限检查工具
│       ├── NotificationUtils.h/cc  # 通知工具
│       └── DbUtils.h/cc            # 数据库工具
├── sql/
│   └── init.sql                    # 数据库初始化脚本
├── config.json                     # 服务配置文件
└── CMakeLists.txt                  # CMake 配置
```

### 代码骨架建议

#### 控制器层

使用 Drogon `HttpController`，按资源分文件：

```cpp
// AuthController.h
class AuthController : public drogon::HttpController<AuthController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(AuthController::registerHandler, "/api/auth/register", Post);
        ADD_METHOD_TO(AuthController::loginHandler, "/api/auth/login", Post);
        ADD_METHOD_TO(AuthController::refreshHandler, "/api/auth/refresh", Post);
    METHOD_LIST_END

    void registerHandler(const HttpRequestPtr& req,
                        std::function<void(const HttpResponsePtr&)>&& callback);
    // ...
};
```

#### 中间件层

```cpp
// JwtAuthFilter.h
class JwtAuthFilter : public drogon::HttpFilter<JwtAuthFilter> {
public:
    void doFilter(const HttpRequestPtr& req,
                 drogon::FilterCallback&& fcb,
                 drogon::FilterChainCallback&& fccb);
};
```

#### 仓储层

基于 libpqxx 的数据访问：

```cpp
// UserRepository.h
class UserRepository {
public:
    static void getUserById(int userId, 
                            std::function<void(const User&)> successCallback,
                            std::function<void(const std::exception&)> errorCallback);
    // ...
};
```

#### 服务层

业务逻辑封装：

```cpp
// DocumentService.h
class DocumentService {
public:
    static void createDocument(int ownerId, const std::string& title,
                              std::function<void(int docId)> successCallback,
                              std::function<void(const std::exception&)> errorCallback);
    // ...
};
```

---

## 配置说明

### config.json 配置

```json
{
  "listeners": [
    {
      "address": "0.0.0.0",
      "port": 8080
    }
  ],
  "app": {
    "jwt_secret": "your-secret-key-here",
    "jwt_access_expires_in": 900,
    "jwt_refresh_expires_in": 2592000,
    "threads_num": 4,
    "meilisearch_url": "http://localhost:7700",
    "meilisearch_master_key": "your_master_key_here",
    "webhook_token": "your_webhook_token_here",
    "minio_endpoint": "localhost:9000",
    "minio_access_key": "minioadmin",
    "minio_secret_key": "minioadmin",
    "minio_bucket": "documents"
  },
  "log": {
    "log_path": "./logs",
    "log_level": "DEBUG"
  },
  "plugins": [],
  "db_clients": [
    {
      "name": "default",
      "rdbms": "postgresql",
      "host": "127.0.0.1",
      "port": 5432,
      "dbname": "collab",
      "user": "collab",
      "passwd": "20050430",
      "is_fast": false,
      "connection_number": 5,
      "characterSet": "utf8"
    }
  ]
}
```

### 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `listeners` | 服务监听地址和端口 | `0.0.0.0:8080` |
| `app.jwt_secret` | JWT 密钥（必须修改） | - |
| `app.jwt_access_expires_in` | Access Token 过期时间（秒） | 900（15分钟） |
| `app.jwt_refresh_expires_in` | Refresh Token 过期时间（秒） | 2592000（30天） |
| `app.threads_num` | 工作线程数 | 4 |
| `app.meilisearch_url` | Meilisearch 服务地址 | `http://localhost:7700` |
| `app.meilisearch_master_key` | Meilisearch 主密钥 | - |
| `app.webhook_token` | Webhook 验证令牌 | - |
| `app.minio_endpoint` | MinIO 服务地址 | `localhost:9000` |
| `app.minio_access_key` | MinIO 访问密钥 | - |
| `app.minio_secret_key` | MinIO 密钥 | - |
| `app.minio_bucket` | MinIO 存储桶名称 | `documents` |
| `log.log_path` | 日志文件路径 | `./logs` |
| `log.log_level` | 日志级别（DEBUG/INFO/WARN/ERROR） | DEBUG |
| `db_clients[].rdbms` | 数据库类型 | `postgresql` |
| `db_clients[].connection_number` | 连接池大小 | 5 |
| `db_clients[].is_fast` | 是否使用快速客户端 | `false`（建议） |

### 环境变量配置（可选）

创建 `.env` 文件：

```bash
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=collab
DB_USER=collab
DB_PASSWORD=20050430

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=2592000

# Object Storage (MinIO) - 可选
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=doc-snapshots

# Search - 可选
SEARCH_ENDPOINT=http://127.0.0.1:7700
SEARCH_API_KEY=

# Collaboration service
COLLAB_WS_URL=ws://127.0.0.1:1234
COLLAB_SNAPSHOT_WEBHOOK=http://127.0.0.1:8080/api/collab/snapshot

# Server
APP_PORT=8080
APP_ENV=development
```

---

## 构建与运行

### 前置要求

- Ubuntu 20.04+ / WSL2
- CMake 3.14+
- C++17 编译器（GCC 7+ / Clang 5+）
- PostgreSQL 12+ / openGauss
- Drogon 1.9.11+
- jwt-cpp
- jsoncpp

### 安装依赖

```bash
# 更新包管理器
sudo apt update

# 安装构建工具和基础库
sudo apt install -y \
    build-essential \
    cmake \
    libpq-dev \
    libpqxx-dev \
    libssl-dev \
    zlib1g-dev \
    libjsoncpp-dev \
    postgresql \
    postgresql-contrib \
    git

# 安装 Drogon（需要从源码编译）
# 参考：https://github.com/drogonframework/drogon

# 安装 jwt-cpp
git clone https://github.com/Thalhammer/jwt-cpp.git
cd jwt-cpp
mkdir build && cd build
cmake .. -DCMAKE_INSTALL_PREFIX=/usr/local
make && sudo make install
```

### 初始化数据库

```bash
# 启动 PostgreSQL 服务
sudo service postgresql start

# 创建数据库和用户
sudo -u postgres psql << EOF
CREATE DATABASE collab;
CREATE USER collab WITH PASSWORD '20050430';
GRANT ALL PRIVILEGES ON DATABASE collab TO collab;
\q
EOF

# 执行初始化脚本
PGPASSWORD=20050430 psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/init.sql
```

### 编译项目

```bash
cd cpp-service
mkdir -p build && cd build
cmake ..
make -j$(nproc)
```

### 运行服务

```bash
# 确保 config.json 在运行目录
cp ../config.json .

# 运行服务
./cpp-service
```

服务默认运行在 `http://localhost:8080`

---

## 关键流程

### 1. 用户登录流程

```.
Client -> POST /api/auth/login
  -> AuthController::loginHandler
    -> 验证邮箱/密码
    -> 生成 JWT Token
    -> 返回 access_token + refresh_token
```

### 2. 文档创建流程

```.
Client -> POST /api/docs (with JWT)
  -> JwtAuthFilter (验证 Token)
    -> DocumentController::createHandler
      -> DocumentService::createDocument
        -> DocumentRepository::insertDocument
          -> 返回文档 ID
```

### 3. 协作快照回调流程

```.
y-websocket -> POST /api/collab/snapshot/:docId
  -> 验证 Webhook Token
    -> 检查 ACL 权限
      -> 幂等性检查（sha256）
        -> 保存 document_version
          -> 异步更新搜索索引
            -> 通知协作者
```

### 4. 协作加入鉴权流程

```.
Client -> POST /api/collab/token
  -> 验证用户身份和 ACL
    -> 生成一次性 JWT Token
      -> Client 携带 Token 连接 y-websocket
        -> y-websocket 验证 Token
          -> 加入房间
```

### 5. 版本发布/回滚流程

```.
发布：
  POST /api/docs/:id/publish
    -> 获取最新快照
      -> 更新 document.last_published_version_id
        -> 刷新搜索索引

回滚：
  POST /api/docs/:id/rollback/:versionId
    -> 获取指定版本快照
      -> 设为引导快照
        -> 触发发布流程
```

### 6. 实时通讯消息流程

```.
Client -> POST /api/chat/rooms/{id}/messages
  -> JwtAuthFilter（校验用户属于房间）
    -> ChatController::sendMessage
      -> 写入 chat_message / chat_message_read
        -> 返回消息 ID + 时间戳
          -> 调用 collab-service WebSocket 广播 {type:"message", ...}
            -> 其他客户端 append 消息并更新未读
```

断线重连：

```.
Client -> WebSocket reconnect
  -> chat-handler 校验 token + room_id
    -> 重新加入房间
      -> HTTP 拉取历史消息补齐 gap
        -> 更新 last_read_at，清空未读
```

---

## 错误码规范

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| 0 | OK | 200 |
| 1001 | INVALID_PARAM | 400 |
| 1002 | UNAUTHORIZED | 401 |
| 1003 | FORBIDDEN | 403 |
| 1004 | NOT_FOUND | 404 |
| 1005 | CONFLICT | 409 |
| 2001 | DB_ERROR | 500 |
| 2002 | STORAGE_ERROR | 500 |
| 2003 | SEARCH_ERROR | 500 |

### 错误响应格式

```json
{
  "error": "错误描述信息",
  "code": 1001
}
```

---

## 安全实现

### 密码加密

使用 SHA-256 + 随机盐值（16 字节）：

```cpp
// 存储格式：$sha256$salt$hash
std::string hashPassword(const std::string& password);
bool verifyPassword(const std::string& password, const std::string& storedHash);
```

### JWT 认证

- **算法**：HS256
- **Access Token**：15 分钟有效期
- **Refresh Token**：30 天有效期
- **Token 存储**：可选的 Redis 黑名单机制

### 输入验证

- 邮箱格式验证
- 密码强度检查（最少 8 位）
- SQL 注入防护（参数化查询）
- XSS 防护（输出转义）

### 速率限制

建议使用 Redis 实现：

```cpp
// 示例：每分钟最多 10 次请求
bool checkRateLimit(const std::string& key, int maxRequests, int windowSeconds);
```

### 文件上传安全

- 扩展名白名单检查
- MIME 类型验证
- 文件大小限制
- 生成预签名 URL 访问对象存储

---

## 部署指南

### 开发环境

**单机部署（WSL2）**：

```bash
# 1. 启动 PostgreSQL
sudo service postgresql start

# 2. 启动 Redis（如果使用）
sudo service redis-server start

# 3. 启动 C++ 服务
cd cpp-service/build
./cpp-service
```

### Docker Compose 部署（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: collab
      POSTGRES_USER: collab
      POSTGRES_PASSWORD: 20050430
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin

  cpp-service:
    build: ./cpp-service
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./cpp-service/config.json:/app/config.json
```

### 反向代理配置（Nginx）

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 生产环境注意事项

1. **安全配置**：
   - 修改默认密码和密钥
   - 启用 TLS/HTTPS
   - 配置防火墙规则
   - 定期更新依赖

2. **性能优化**：
   - 调整连接池大小
   - 启用数据库连接池
   - 配置 Redis 缓存
   - 使用 CDN 加速静态资源

3. **监控与日志**：
   - 配置日志轮转
   - 设置健康检查
   - 监控服务状态
   - 配置告警机制

4. **备份策略**：
   - 数据库定期备份
   - 对象存储备份
   - 配置文件版本控制

---

## 公共组件

### 日志组件

使用 Drogon 内置日志：

```cpp
LOG_DEBUG << "Debug message";
LOG_INFO << "Info message";
LOG_WARN << "Warning message";
LOG_ERROR << "Error message";
```

### 数据库连接管理

```cpp
// 获取数据库客户端
auto db = drogon::app().getDbClient();

// 执行异步查询
db->execSqlAsync(
    "SELECT * FROM \"user\" WHERE id = $1::integer",
    [](const drogon::orm::Result& r) {
        // 处理结果
    },
    [](const drogon::orm::DrogonDbException& e) {
        // 处理错误
    },
    std::to_string(userId)
);
```

### 响应工具类

使用 `ResponseUtils` 统一响应格式：

```cpp
// 成功响应
ResponseUtils::sendSuccess(callback, data);

// 错误响应
ResponseUtils::sendError(callback, "错误信息", k400BadRequest);
```

---

## 参考文档

- [总体设计文档](./ARCH-01-总体设计.md) - 整体架构和模块划分
- [需求文档](./REQ-01-需求文档.md) - 项目需求文档
- [API 设计文档](./API-01-API设计.md) - API 设计文档
- [第一阶段开发指南](./PHASE-01-用户认证开发指南.md) - 第一阶段开发指南
- [第二阶段开发指南](./PHASE-02-文档管理开发指南.md) - 第二阶段开发指南
- [第三阶段开发指南](./PHASE-03-协作功能开发指南.md) - 第三阶段开发指南
- [项目启动指南](./GUIDE-01-项目启动指南.md) - 项目启动和运行指南
- [后端 API 测试方法](./GUIDE-02-后端API测试方法.md) - API 测试方法
- [开发提示与最佳实践](./completed/DEV-07-开发提示与最佳实践.md) - 开发规范和最佳实践
