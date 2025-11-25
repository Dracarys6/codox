# codox

**codox**
一个由 C++/Drogon、Node.js y-websocket 与 React/Vite 前端协同打造的多人在线协作文档系统。

## 📋 项目简介

当前仓库涵盖：

- `cpp-service`：Drogon + PostgreSQL 的主业务 API（文档、权限、评论、任务、通知、搜索、导入导出等）
- `collab-service`：Yjs WebSocket 网关，负责实时协作与通知推送通道
- `doc-converter-service`：Node.js 文档转换服务，提供 Word/PDF/Markdown 格式转换
- `frontend`：Tiptap 编辑器 + React 前端，集成协作、通知、任务与导入导出功能
- `docs`：需求 / 设计 / 启动 / 功能清单 / 项目总结等发布文档

### 核心功能&进度

- ✅ **认证与安全**：注册 / 登录 / Token 刷新、SHA-256+Salt、JwtAuthFilter
- ✅ **文档 & 权限**：文档 CRUD、ACL、版本发布/回滚、快照（MinIO）
- ✅ **实时协作**：Yjs + y-websocket、协作令牌、快照回调、引导快照
- ✅ **评论 / 任务 / 通知**：后端接口 + 前端侧边栏/看板/通知中心
- ✅ **全文搜索**：Meilisearch 索引同步 + 搜索页
- ✅ **用户搜索**：支持按ID、邮箱、昵称搜索用户，用于 ACL 权限管理
- ✅ **文档导入导出**：Word/PDF/Markdown 格式导入导出，独立转换服务
- ✅ **文档状态管理**：支持草稿、已保存、已发布、已归档、已锁定等状态，保存后自动更新状态
- ✅ **主页统计优化**：协作文档和需要关注文档的统计与列表展示
- ✅ **通知筛选功能**：支持按类型、文档ID、日期范围、未读状态筛选通知
- ✅ **通知偏好设置**：按通知类型配置站内 / 邮件 / 推送开关（`notification_setting`）
- ✅ **版本时间线与差异对比**：版本时间线筛选、单版本详情、版本 Diff 预览与一键恢复
- ✅ **管理员用户管理**：用户列表筛选、CSV 导出、账号状态与角色调整、审计日志
- ✅ **运营与满意度分析**：活跃度与文档/评论/任务指标统计、满意度问卷收集与报表

## 🛠️ 技术栈

- **Web 框架**：Drogon 1.9.11（C++ HTTP 框架）
- **数据库**：PostgreSQL（libpqxx）
- **认证**：JWT（jwt-cpp）
- **JSON 处理**：jsoncpp
- **加密**：OpenSSL（SHA-256）
- **构建系统**：CMake 3.14+

## 📁 项目结构

```目录
codox/
├── cpp-service/                # C++ 主业务 API（Drogon）
│   ├── src/
│   │   ├── controllers/        # Auth/Document/Collab/Comment/Task/Notification/Search/AdminUser/Feedback...
│   │   ├── utils/              # JwtUtil、PermissionUtils、NotificationUtils 等
│   │   ├── middleware/         # JwtAuthFilter 等
│   │   └── main.cpp
│   ├── sql/
│   │   ├── init.sql            # 初始建表脚本
│   │   └── migration.sql       # 从旧版升级到 2025.11 结构的一体化迁移
│   ├── config.json             # 服务配置（DB、JWT、MinIO、Meilisearch、doc-converter 等）
│   └── CMakeLists.txt
├── collab-service/             # 协作与通知 WebSocket 网关 (Node.js + TypeScript + Yjs)
│   ├── server.ts
│   ├── package.json
│   └── README_协作服务.md
├── doc-converter-service/      # 文档转换服务 (Node.js)
│   ├── index.js
│   ├── package.json
│   └── README_文档转换服务.md
├── frontend/                   # React + Vite + Tiptap 前端
│   ├── src/
│   │   ├── api/client.ts       # Axios API 封装
│   │   ├── components/DocumentEditor.tsx
│   │   ├── components/VersionTimeline.tsx / VersionDiffView.tsx
│   │   ├── components/ImportModal.tsx / ExportMenu.tsx
│   │   └── pages/HomePage.tsx / DocumentsPage.tsx / EditorPage.tsx / AdminUsersPage.tsx 等
│   ├── package.json
│   └── README_前端.md
├── docs/                       # 需求 / 设计 / 指南 / 发布说明
│   ├── ARCH-01-总体设计.md
│   ├── ARCH-02-详细设计.md
│   ├── REQ-01-需求文档.md / REQ-01-需求完成文档.md
│   ├── PROJECT-功能清单.md / PROJECT-项目总结.md
│   ├── API-01-API设计.md
│   └── GUIDE-01-项目启动指南.md / GUIDE-03-文档导入导出功能说明.md
├── scripts/                    # 辅助脚本
├── docker-compose.yml          # Meilisearch / MinIO 等支撑服务
└── meili_data/                 # Meilisearch 数据卷（开发环境）
```

## 🚀 快速开始

### 前置要求

- Ubuntu 20.04+ / WSL2
- CMake 3.14+
- C++17 编译器（GCC 7+ / Clang 5+）
- PostgreSQL 12+（推荐 14+）
- Docker & Docker Compose（用于 Meilisearch / MinIO）
- Node.js 18+（运行 `collab-service` / `doc-converter-service` / `frontend`）

### 1. 安装依赖（C++ 后端）

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

### 2. 初始化数据库

```bash
# 启动 PostgreSQL 服务
sudo service postgresql start

# 创建数据库和用户
sudo -u postgres psql << EOF
CREATE DATABASE collab;
CREATE USER collab WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE collab TO collab;
\q
EOF

# 执行初始化脚本（建表）
PGPASSWORD=your_password psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/init.sql

# 如需从旧版本升级到 2025.11，可额外执行整体迁移
PGPASSWORD=your_password psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/migration.sql
```

### 3. 配置服务（cpp-service）

编辑 `cpp-service/config.json`，至少确认以下配置：

- `db_clients`：PostgreSQL 连接（host/port/dbname/user/passwd）
- `app.jwt_secret`：JWT 密钥（须与 `collab-service` 的 `COLLAB_JWT_SECRET` 保持一致）
- `meilisearch_url` / `meilisearch_master_key`：全文检索服务
- `minio_endpoint` / `minio_access_key` / `minio_secret_key` / `minio_bucket`：对象存储
- `doc_converter_url`：文档转换服务地址（默认 `http://localhost:3002`）

更多字段说明可参考 `docs/ARCH-02-详细设计.md`。

### 4. 编译运行 C++ 后端

```bash
cd cpp-service
mkdir -p build && cd build
cmake ..
make -j$(nproc)

# 运行服务
./cpp-service
```

服务默认运行在 `http://localhost:8080`

### 5. 启动协作 WebSocket 服务（collab-service）

```bash
cd collab-service
npm install
npm run dev   # 或 npx tsx server.ts
```

> 默认监听 `ws://localhost:1234`，可通过 `PORT` 环境变量修改；  
> 协作通道使用 `VITE_WS_URL`，通知通道使用 `VITE_NOTIFICATION_WS_URL` 连接 `/ws/notifications`。

### 6. 启动文档转换服务（doc-converter-service）

```bash
cd doc-converter-service
npm install
npm start   # 默认运行在 http://localhost:3002
```

> 文档转换服务提供 Word/PDF/Markdown 格式转换功能，用于文档导入导出。

### 7. 启动支撑服务（Meilisearch & MinIO）

```bash
# 在项目根目录
docker compose up -d meilisearch minio
```

- Meilisearch 控制台：`http://localhost:7700`（`MASTER_KEY` 需与 `config.json` 一致）
- MinIO 控制台：`http://localhost:9001`（默认 `minioadmin:minioadmin`）

### 8. 启动前端（frontend）

```bash
cd frontend
npm install
npm run dev  # 默认 http://localhost:3000（见 vite.config.ts）
```

创建 `.env.local`（如有 `.env.local.example` 可复制），至少配置：

```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:1234
VITE_NOTIFICATION_WS_URL=ws://localhost:1234/ws/notifications
```

至此即可在浏览器中完成「鉴权 → 文档 → 协作编辑 → 通知 → 管理员运营」的完整闭环测试。

## 📡 主要 API 端点

### 用户相关
- `GET /api/users/me` - 获取当前用户信息
- `PATCH /api/users/me` - 更新用户资料
- `GET /api/users/search` - 搜索用户（按ID、邮箱、昵称）

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新 Token
- `POST /api/auth/password/forgot` - 申请密码重置令牌（开发环境直接返回 token）
- `POST /api/auth/password/reset` - 使用令牌更新密码

### 文档相关
- `GET /api/docs` - 文档列表（支持状态筛选）
- `POST /api/docs` - 创建文档
- `GET /api/docs/{id}` - 文档详情
- `PATCH /api/docs/{id}` - 更新文档（支持状态更新）
- `DELETE /api/docs/{id}` - 删除文档
- `GET /api/docs/{id}/acl` - 获取 ACL 列表
- `PUT /api/docs/{id}/acl` - 更新 ACL
- `POST /api/docs/import/markdown` - 导入 Markdown 文档（支持文件上传和文本输入）
- `GET /api/docs/{id}/export/word` - 导出为 Word
- `GET /api/docs/{id}/export/pdf` - 导出为 PDF
- `GET /api/docs/{id}/export/markdown` - 导出为 Markdown

### 通知相关
- `GET /api/notifications` - 通知列表（支持类型、文档ID、日期范围、未读状态筛选）
- `POST /api/notifications/read` - 标记通知为已读
- `GET /api/notifications/unread-count` - 获取未读通知数量

### 其他
- `GET /api/search` - 全文搜索

详细 API 文档请参考：[API 设计文档](./docs/API-01-API设计.md)

### 健康检查

```bash
GET /health
```

**响应示例**：

```json
{
    "status": "ok",
    "service": "cpp-service",
    "database": "connected",
    "db_type": "PostgreSQL"
}
```

### 用户注册

```bash
POST /api/auth/register
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "password123",
    "nickname": "用户名"
}
```

**成功响应** (201 Created)：

```json
{
    "id": 1,
    "email": "user@example.com"
}
```

**错误响应**：

- `400 Bad Request`：邮箱格式错误、密码长度不足、邮箱已存在
- `500 Internal Server Error`：数据库错误

### 用户登录

```bash
POST /api/auth/login
Content-Type: application/json

{
    "account": "user@example.com",
    "password": "password123"
}
```

**成功响应** (200 OK)：

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

**错误响应**：

- `400 Bad Request`：缺少必填字段
- `401 Unauthorized`：用户名或密码错误

### 刷新 Token

```bash
POST /api/auth/refresh
Content-Type: application/json

{
    "refresh_token": "eyJhbGci..."
}
```

**成功响应** (200 OK)：

```json
{
    "access_token": "eyJhbGci..."
}
```

**错误响应**：

- `400 Bad Request`：缺少 refresh_token
- `401 Unauthorized`：无效或过期的 refresh_token

## 🧪 测试示例

```bash
# 1. 检查服务状态
curl http://localhost:8080/health | python3 -m json.tool

# 2. 注册新用户
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test12345", "nickname": "测试用户"}' \
  | python3 -m json.tool

# 3. 用户登录
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account": "test@example.com", "password": "test12345"}' \
  | python3 -m json.tool

# 4. 刷新 Token
REFRESH_TOKEN="your_refresh_token_here"
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}" \
  | python3 -m json.tool
```

## 🔧 配置说明

`config.json` 主要配置项：

- **listeners**：服务监听地址和端口
- **app**：应用配置（JWT 密钥、过期时间、线程数等）
- **log**：日志配置（路径、级别）
- **db_clients**：数据库连接配置
  - `rdbms`：数据库类型（postgresql）
  - `connection_number`：连接池大小
  - `is_fast`：是否使用快速客户端（当前版本建议为 false）
- **jwt_secret**：供 Auth/Collaboration/JwtAuthFilter 共用的密钥
- **webhook_token**：快照回调所需的 `X-Webhook-Token`
- **meilisearch_url / meilisearch_master_key**：全文搜索服务地址与密钥
- **minio_* 系列**：快照/附件默认落地到 MinIO，对应 endpoint / access_key / secret_key / bucket
- **doc_converter_url**：文档转换服务地址，默认 `http://localhost:3002`
- **password_reset_token_ttl_minutes**：密码重置令牌有效期（分钟），默认 30
- **expose_password_reset_token**：开发模式下是否直接在 API 响应中返回 reset token，生产环境建议关闭并改为邮件发送

## 🔒 安全特性

- **密码加密**：使用 SHA-256 + 随机盐值（16 字节）
- **JWT 认证**：短期 access_token（15 分钟）+ 长期 refresh_token（30 天）
- **参数化查询**：防止 SQL 注入攻击
- **输入验证**：邮箱格式、密码强度检查

## 📚 文档

### 核心文档
- **[总体设计文档](./docs/ARCH-01-总体设计.md)** - 系统架构、模块划分、开发路线图
- **[详细设计文档](./docs/ARCH-02-详细设计.md)** - 数据库设计、API 规格、代码结构、部署指南
- **[需求文档](./docs/REQ-01-需求文档.md)** - 项目需求文档
- **[API 设计文档](./docs/API-01-API设计.md)** - API 设计文档
- **[功能清单](./docs/PROJECT-功能清单.md)** - 项目功能清单

### 操作指南
- **[项目启动指南](./docs/GUIDE-01-项目启动指南.md)** - 项目启动和运行指南

## 📦 发布信息

- **版本**：2025.11 Release（发布于 2025-11-25）
- **范围**：包含认证、文档 / 版本 / ACL、协作、评论、任务、通知、搜索、导入导出、状态管理、主页统计、通知偏好、版本时间线差异、管理员用户管理、运营分析与满意度反馈等全部核心能力
- **数据库**：`sql/init.sql` 可用于全新部署，`sql/migration.sql` 用于旧版本升级
- **客户端**：`frontend` 默认 dev 端口 3000；`VITE_WS_URL` / `VITE_NOTIFICATION_WS_URL` 配置协作与通知 WebSocket
- **确认事项**：实时聊天模块正式取消；版本管理增强与管理员后台已完成交付并已在 README 顶部功能列表中标记 ✅

## 🐛 常见问题

### 数据库连接失败

1. 检查 PostgreSQL 服务是否运行：`sudo service postgresql status`
2. 验证数据库和用户是否存在：`psql -U collab -d collab -c "\conninfo"`
3. 确认 `config.json` 中的连接信息正确
4. 检查防火墙设置

### 编译错误

- **找不到 Drogon**：确保已正确编译安装 Drogon，并设置 `DROGON_INSTALL_PREFIX`
- **链接错误**：检查 `CMakeLists.txt` 中的库路径配置

### 运行时错误

- **端口占用**：修改 `config.json` 中的端口号
- **配置文件未找到**：确保 `config.json` 在运行目录或正确路径
- **数据库表不存在**：执行 `sql/init.sql` 初始化脚本

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[待定]

## 👥 作者

- dracarys

---

**版本说明**：本文档对应 codox 2025.11 发布版，如需历史阶段信息请参考 `docs/PROJECT-项目总结.md` 或各阶段开发指南。
