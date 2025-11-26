# C++ 后端服务 (cpp-service)

基于 Drogon 框架的 C++ HTTP API 服务，提供文档管理、权限控制、实时协作、评论、任务、通知和全文搜索等功能。

## 📋 功能模块

### 已实现功能

- ✅ **用户认证** (`AuthController`)
  - 用户注册、登录、Token 刷新
  - JWT 认证中间件
  - 密码加密（SHA-256 + Salt）

- ✅ **文档管理 & 版本增强** (`DocumentController`)
  - 文档 CRUD / 标签 / ACL
  - 自动+手动版本（`GET/POST /api/docs/{id}/versions`）
  - 版本时间线筛选、单版本详情、Diff、恢复
- ✅ **文档导入导出**
  - Markdown 导入、Word/PDF/Markdown 导出
  - 对接 `doc-converter-service`、MinIO 快照

- ✅ **实时协作** (`CollaborationController`)
  - 协作令牌生成
  - 快照上传回调处理
  - 文档版本记录

- ✅ **评论系统** (`CommentController`)
  - 评论创建、查询、更新、删除
  - 评论回复支持

- ✅ **任务管理** (`TaskController`)
  - 任务创建、查询、更新
  - 任务状态管理

- ✅ **通知系统** (`NotificationController`)
  - 通知查询、筛选、已读标记、未读计数
  - `NotificationWebSocket` 实时推送

- ✅ **全文搜索** (`SearchController`)
  - Meilisearch 集成
  - 文档搜索和权限过滤

- ✅ **用户管理** (`UserController`)
  - 用户资料查询和更新

- ✅ **管理员与运营** (`AdminUserController`)
  - 用户列表查询/导出、状态与角色调整
  - 活跃度、文档/评论/任务指标统计

- ✅ **满意度反馈** (`FeedbackController`)
  - 提交满意度与文本意见
  - 管理端满意度统计 API

## 🛠️ 技术栈

- **Web 框架**: Drogon 1.9.11
- **数据库**: PostgreSQL (libpqxx)
- **认证**: JWT (jwt-cpp)
- **JSON 处理**: jsoncpp
- **加密**: OpenSSL (SHA-256)
- **构建系统**: CMake 3.14+

## 📁 项目结构

```
cpp-service/
├── src/
│   ├── controllers/          # API 控制器
│   │   ├── AuthController.*       # 认证相关
│   │   ├── DocumentController.*   # 文档管理
│   │   ├── CollaborationController.* # 协作相关
│   │   ├── CommentController.*    # 评论管理
│   │   ├── TaskController.*       # 任务管理
│   │   ├── NotificationController.* # 通知管理
│   │   ├── SearchController.*     # 搜索服务
│   │   ├── UserController.*       # 用户管理
│   │   └── HealthController.*     # 健康检查
│   ├── services/             # 业务服务层
│   │   └── SearchService.*        # Meilisearch 集成
│   ├── utils/                # 工具类
│   │   ├── JwtUtil.*             # JWT 工具
│   │   ├── PermissionUtils.*     # 权限检查
│   │   └── NotificationUtils.*   # 通知创建
│   ├── middleware/           # 中间件
│   │   └── JwtAuthFilter.*       # JWT 认证过滤器
│   └── main.cpp              # 程序入口
├── sql/                      # SQL 脚本
│   └── init.sql              # 数据库初始化脚本
├── config.json               # 服务配置文件
├── CMakeLists.txt            # CMake 构建配置
└── README.md                 # 本文档
```

## 🚀 快速开始

### 前置要求

- Ubuntu 20.04+ / WSL2
- CMake 3.14+
- C++17 编译器（GCC 7+ / Clang 5+）
- PostgreSQL 12+
- 已安装 Drogon 框架
- 已安装 jwt-cpp 库

### 1. 安装依赖

```bash
# 安装系统依赖 (Ubuntu / Debian)
sudo apt update
sudo apt install -y \
    build-essential \
    cmake \
    libpq-dev \
    libpqxx-dev \
    libssl-dev \
    zlib1g-dev \
    libjsoncpp-dev \
    postgresql \
    postgresql-contrib

# Drogon 与 jwt-cpp 建议使用包管理器或统一安装目录
# 例如：
#   Ubuntu: sudo apt install drogon libjwt-cpp-dev
#   macOS:  brew install drogon jwt-cpp
#   其他发行版: 参考官方文档，安装到同一前缀 (如 ~/.local)
#
# 若需源码编译，可统一安装到 $HOME/.local 后在构建时指定 CMAKE_PREFIX_PATH：
# git clone https://github.com/drogonframework/drogon.git
# cmake -S . -B build -DCMAKE_INSTALL_PREFIX=$HOME/.local && cmake --build build --target install
#
# git clone https://github.com/Thalhammer/jwt-cpp.git
# cmake -S . -B build -DCMAKE_INSTALL_PREFIX=$HOME/.local && cmake --build build --target install
```

### 2. 配置数据库

确保 PostgreSQL 已启动并创建数据库：

```bash
# 启动 PostgreSQL
sudo service postgresql start

# 创建数据库和用户（如果尚未创建）
sudo -u postgres psql << EOF
CREATE DATABASE collab;
CREATE USER collab WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE collab TO collab;
\q
EOF

# 执行初始化脚本
PGPASSWORD=your_password psql -h 127.0.0.1 -p 5432 -U collab -d collab -f sql/init.sql
```

### 3. 配置服务

编辑 `config.json`，确保配置正确：

```json
{
    "listeners": [
        {
            "address": "0.0.0.0",
            "port": 8080
        }
    ],
    "app": {
        "jwt_secret": "your-jwt-secret-key",
        "jwt_access_expires_in": 900,
        "jwt_refresh_expires_in": 2592000,
        "threads_num": 4,
        "webhook_token": "your-webhook-token",
        "meilisearch_url": "http://localhost:7700",
        "meilisearch_master_key": "your-meilisearch-master-key",
        "minio_endpoint": "localhost:9000",
        "minio_access_key": "minioadmin",
        "minio_secret_key": "minioadmin",
        "minio_bucket": "documents"
    },
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
            "connection_number": 10
        }
    ]
}
```

### 4. 编译

```bash
cd cpp-service
mkdir -p build
cmake -B build -S . \
  -DCMAKE_PREFIX_PATH="/path/to/drogon;/path/to/jwt-cpp"
cmake --build build -j$(nproc)
```

> `CMAKE_PREFIX_PATH` 指向 Drogon 与 jwt-cpp 的安装前缀；若使用系统包管理器并安装在系统默认路径，可省略该参数。

### 5. 运行

```bash
# 从 build 目录运行
./cpp-service

# 或从项目根目录运行
cd build
./cpp-service
```

服务默认运行在 `http://localhost:8080`

## 📡 API 端点

### 认证相关

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新 Token

### 文档相关

- `GET /api/documents` - 获取文档列表
- `POST /api/documents` - 创建文档
- `GET /api/documents/:id` - 获取文档详情
- `PUT /api/documents/:id` - 更新文档
- `DELETE /api/documents/:id` - 删除文档
- `GET /api/documents/:id/versions` - 获取文档版本列表
- `POST /api/documents/:id/permissions` - 设置文档权限

### 协作相关

- `GET /api/collab/token/:docId` - 获取协作令牌
- `POST /api/collab/snapshot/:docId` - 处理快照回调

### 评论相关

- `GET /api/comments` - 获取评论列表
- `POST /api/comments` - 创建评论
- `PUT /api/comments/:id` - 更新评论
- `DELETE /api/comments/:id` - 删除评论

### 任务相关

- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `PATCH /api/tasks/:id/status` - 更新任务状态

### 通知相关

- `GET /api/notifications` - 获取通知列表
- `POST /api/notifications/read` - 标记通知为已读

### 搜索相关

- `GET /api/search` - 全文搜索文档

### 用户相关

- `GET /api/users/me` - 获取当前用户信息
- `PUT /api/users/me` - 更新用户信息

### 健康检查

- `GET /health` - 服务健康检查

详细的 API 文档请参考 `docs/后端API测试方法.md`

## 🔧 配置说明

### config.json 主要配置项

- **listeners**: 服务监听地址和端口
- **app**: 应用配置
  - `jwt_secret`: JWT 密钥（用于签名和验证 Token）
  - `jwt_access_expires_in`: Access Token 过期时间（秒）
  - `jwt_refresh_expires_in`: Refresh Token 过期时间（秒）
  - `threads_num`: 工作线程数
  - `webhook_token`: 快照回调所需的 Webhook Token
  - `meilisearch_url`: Meilisearch 服务地址
  - `meilisearch_master_key`: Meilisearch Master Key
  - `minio_*`: MinIO 对象存储配置
- **log**: 日志配置
  - `log_path`: 日志文件路径
  - `log_level`: 日志级别（DEBUG/INFO/WARN/ERROR）
- **db_clients**: 数据库连接配置
  - `rdbms`: 数据库类型（postgresql）
  - `connection_number`: 连接池大小
  - `is_fast`: 是否使用快速客户端（建议为 false）

## 🧪 测试

### 健康检查

```bash
curl http://localhost:8080/health
```

### 使用 HTTPie 测试 API

```bash
# 登录获取 Token
TOKEN=$(http POST localhost:8080/api/auth/login account=test@example.com password=test12345 | jq -r '.access_token')

# 使用 Token 访问 API
http GET localhost:8080/api/documents Authorization:"Bearer $TOKEN"
```

详细的测试方法请参考 `docs/后端API测试方法.md`

## 🐛 常见问题

### 编译错误

- **找不到 Drogon**: 检查 `CMakeLists.txt` 中的 `DROGON_INSTALL_PREFIX` 是否正确
- **找不到 jwt-cpp**: 确保已安装 jwt-cpp 到 `/usr/local`
- **链接错误**: 检查 `CMakeLists.txt` 中的库路径配置

### 运行时错误

- **端口占用**: 修改 `config.json` 中的端口号
- **配置文件未找到**: 确保 `config.json` 在运行目录或正确路径
- **数据库连接失败**: 
  - 检查 PostgreSQL 是否运行
  - 检查 `config.json` 中的数据库配置
  - 检查数据库用户权限
- **Meilisearch 连接失败**: 
  - 检查 Meilisearch 服务是否运行
  - 检查 `meilisearch_url` 和 `meilisearch_master_key` 配置
- **MinIO 连接失败**: 
  - 检查 MinIO 服务是否运行
  - 检查 MinIO 配置和凭证

## 📚 相关文档

- [项目启动指南](../docs/GUIDE-01-项目启动指南.md)
- [后端 API 测试方法](../docs/GUIDE-02-后端API测试方法.md)

## 🔒 安全特性

- **密码加密**: SHA-256 + 随机盐值（16 字节）
- **JWT 认证**: 短期 access_token（15 分钟）+ 长期 refresh_token（30 天）
- **参数化查询**: 防止 SQL 注入攻击
- **输入验证**: 邮箱格式、密码强度检查
- **权限控制**: 基于 ACL 的细粒度权限管理

---

**注意**: 本服务是 Codox 项目的核心后端服务，需要与前端、协作服务和基础设施服务（PostgreSQL、Meilisearch、MinIO）配合使用。

