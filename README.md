# codox

**codox**
一个由 C++/Drogon、Node.js y-websocket 与 React/Vite 前端协同打造的多人在线协作文档系统。

## 📋 项目简介

当前仓库涵盖：

- `cpp-service`：Drogon + PostgreSQL 的主业务 API（文codox档、权限、评论、任务、通知、搜索网关等）
- `collab-service`：Yjs WebSocket 网关，负责实时协作数据通道
- `frontend`：Tiptap 编辑器 + React 前端，接入实时协作、评论与任务面板
- `docs`：逐阶段的设计 / 验收指南（第三阶段主打实时协作与协同工具）

### 核心功能&进度

- ✅ **认证与安全**：注册 / 登录 / Token 刷新、SHA-256+Salt、JwtAuthFilter
- ✅ **文档 & 权限**：文档 CRUD、版本、ACL（第二阶段主线）
- ✅ **实时协作基础**：协作令牌、快照回调、DocumentEditor + collab-service （Beta）
- 🟡 **评论 / 任务 / 通知 API**：后端接口已就绪，等待前端整合
- 🟡 **全文搜索**：Meilisearch 接入层已预置，待前端结果页
- ⏳ **多端体验**：评论、任务、搜索的前端 UI 正在收尾

## 🛠️ 技术栈

- **Web 框架**：Drogon 1.9.11（C++ HTTP 框架）
- **数据库**：PostgreSQL（libpqxx）
- **认证**：JWT（jwt-cpp）
- **JSON 处理**：jsoncpp
- **加密**：OpenSSL（SHA-256）
- **构建系统**：CMake 3.14+

## 📁 项目结构

```目录
MultiuserDocument/
├── cpp-service/           # C++ 后端服务
│   ├── src/
│   │   ├── controllers/   # API 控制器
│   │   │   ├── AuthController.*       # 认证
│   │   │   ├── DocumentController.*   # 文档、ACL、版本
│   │   │   ├── CollaborationController.* # 协作令牌 & 快照
│   │   │   ├── Comment|Task|NotificationController.* # 第三阶段接口
│   │   │   └── SearchController.*     # 全文检索代理
│   │   ├── utils/         # 工具类（JwtUtil、PermissionUtils、NotificationUtils...）
│   │   └── main.cpp       # 程序入口
│   ├── sql/               # SQL 脚本
│   │   └── init.sql       # 数据库初始化脚本
│   ├── config.json        # 服务配置文件
│   └── CMakeLists.txt     # CMake 配置
├── collab-service/        # y-websocket 网关 (Node.js + TypeScript)
│   ├── server.ts
│   └── tsconfig.json
├── frontend/              # React + Tiptap 前端
│   ├── src/components/DocumentEditor.tsx
│   ├── src/api/client.ts  # 与 cpp-service 协作
│   └── ...
├── docs/                  # 项目文档
│   ├── 第三阶段开发指南.md
│   ├── 第一/二阶段指南.md
│   ├── 总体设计.md
│   └── ...
└── README.md
```

## 🚀 快速开始

### 前置要求

- Ubuntu 20.04+ / WSL2
- CMake 3.14+
- C++17 编译器（GCC 7+ / Clang 5+）
- PostgreSQL 12+
- Node.js 18+（运行 `collab-service` 与 `frontend`）

### 1. 安装依赖

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

# 执行初始化脚本
PGPASSWORD=your_password psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/init.sql
```

### 3. 配置服务

编辑 `cpp-service/config.json`，确保数据库连接信息正确：

```json
{
    "db_clients": [
        {
            "name": "default",
            "rdbms": "postgresql",
            "host": "127.0.0.1",
            "port": 5432,
            "dbname": "collab",
            "user": "collab",
            "passwd": "your_password",
            "is_fast": false,
            "connection_number": 5
        }
    ]
}
```

### 4. 编译运行

```bash
cd cpp-service
mkdir -p build && cd build
cmake ..
make -j$(nproc)

# 运行服务
./cpp-service
```

服务默认运行在 `http://localhost:8080`

### 5. 启动协作 WebSocket 服务

```bash
cd collab-service
npm install
npm run dev   # 或 npx tsx server.ts
```

> 默认监听 `ws://localhost:1234`，可通过 `server.ts`/容器参数修改；前端通过 `VITE_WS_URL` 读取。

### 6. 启动支撑服务（Meilisearch & MinIO）

```bash
# 在项目根目录
docker compose up -d meilisearch minio
```

- Meilisearch 控制台：`http://localhost:7700`（Master Key 见 `cpp-service/config.json`）
- MinIO 控制台：`http://localhost:9001`（默认 `minioadmin:minioadmin`）

### 7. 启动前端

```bash
cd frontend
npm install
npm run dev  # 默认 http://localhost:5173
```

将 `.env.example`（若存在）复制为 `.env.local`，至少配置：

```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:1234
```

至此即可在浏览器中完成「鉴权 → 文档 → 协作编辑」的闭环测试。

## 📡 API 端点

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

## 🔒 安全特性

- **密码加密**：使用 SHA-256 + 随机盐值（16 字节）
- **JWT 认证**：短期 access_token（15 分钟）+ 长期 refresh_token（30 天）
- **参数化查询**：防止 SQL 注入攻击
- **输入验证**：邮箱格式、密码强度检查

## 📚 文档

- **[总体设计文档](./docs/ARCH-01-总体设计.md)** - 系统架构、模块划分、开发路线图
- **[详细设计文档](./docs/ARCH-02-详细设计.md)** - 数据库设计、API 规格、代码结构、部署指南
- **[需求文档](./docs/REQ-01-需求文档.md)** - 项目需求文档
- **[API 设计文档](./docs/API-01-API设计.md)** - API 设计文档
- **[第一阶段开发指南](./docs/PHASE-01-用户认证开发指南.md)** - 用户认证与基础功能 ✅
- **[第二阶段开发指南](./docs/PHASE-02-文档管理开发指南.md)** - 文档 CRUD、权限管理与版本控制 ✅
- **[第三阶段开发指南](./docs/PHASE-03-协作功能开发指南.md)** - 实时协作、评论、任务、通知、搜索 ✅
- **[第四阶段开发指南](./docs/PHASE-04-导入导出开发指南.md)** - 导入导出、模板系统、监控与日志 📅
- **[项目启动指南](./docs/GUIDE-01-项目启动指南.md)** - 项目启动和运行指南
- **[后端 API 测试方法](./docs/GUIDE-02-后端API测试方法.md)** - API 测试方法

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

## 🗺️ 开发路线图

### ✅ 第一阶段（已完成）

- [x] 项目环境搭建
- [x] 数据库初始化
- [x] 用户认证系统（注册/登录/刷新）
- [x] 健康检查接口
- [x] JWT 令牌管理
- [x] 密码加密实现

### ✅ 第二阶段（已完成）

- [x] 文档 CRUD 接口
- [x] 文档权限管理（ACL & doc_acl 表）
- [x] 文档版本管理
- [x] 用户资料管理

### ✅ 第三阶段（已完成）

- [x] 协作令牌 / 快照接口（`CollaborationController`）
- [x] y-websocket 网关 & Tiptap 编辑器
- [x] 评论系统（`CommentController`）
- [x] 任务管理（`TaskController`）
- [x] 通知系统（`NotificationController`）
- [x] 全文搜索（`SearchController` + Meilisearch 集成）
- [x] 快照持久化到 MinIO
- [x] 文档索引同步到 Meilisearch

### 📅 第四阶段（当前开发）

- [x] 文档权限管理
- [x] 文档实时通讯（内置聊天）
- [ ] 文档导入导出（Word/PDF/Markdown）
- [ ] 移动端支持（PWA）
- [ ] 监控与告警（Prometheus + Grafana）
- [ ] 集中日志（Loki/ELK）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[待定]

## 👥 作者

- dracarys

---

**注意**：本项目正在积极开发中，API 可能会有变更。请参考最新文档获取最新信息。
