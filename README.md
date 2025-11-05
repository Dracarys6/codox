# MultiuserDocument

一个基于 C++/Drogon 和 PostgreSQL 的多人在线协作文档编辑系统后端服务。

## 📋 项目简介

MultiuserDocument 是一个支持多人实时协作的文档编辑系统，提供用户认证、权限管理、文档 CRUD 等功能。系统采用 C++ 高性能后端框架 Drogon，结合 PostgreSQL 数据库，为前端应用提供稳定的 API 服务。

### 核心功能

- ✅ **用户认证系统**：注册、登录、JWT Token 刷新
- ✅ **密码安全**：SHA-256 哈希加密，随机盐值
- ✅ **数据库连接**：PostgreSQL 连接池管理
- ✅ **健康检查**：服务状态和数据库连接监控
- 🔄 **文档管理**：开发中
- 🔄 **实时协作**：计划中（Yjs + WebSocket）
- 🔄 **权限管理**：计划中（RBAC + ACL）

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
│   │   │   ├── AuthController.h/cc    # 认证相关 API
│   │   │   └── HealthController.h/cc  # 健康检查
│   │   ├── utils/         # 工具类
│   │   │   ├── JwtUtil.h/cc           # JWT 工具
│   │   │   ├── PasswordUtils.h/cc     # 密码加密工具
│   │   │   └── DbUtils.h/cc           # 数据库工具
│   │   └── main.cpp       # 程序入口
│   ├── sql/               # SQL 脚本
│   │   └── init.sql       # 数据库初始化脚本
│   ├── config.json        # 服务配置文件
│   └── CMakeLists.txt     # CMake 配置
├── docs/                  # 项目文档
│   ├── 总体设计.md
│   ├── 详细设计.md
│   ├── AuthController开发指南.md
│   └── ...
└── README.md
```

## 🚀 快速开始

### 前置要求

- Ubuntu 20.04+ / WSL2
- CMake 3.14+
- C++17 编译器（GCC 7+ / Clang 5+）
- PostgreSQL 12+

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
CREATE USER collab WITH PASSWORD '20050430';
GRANT ALL PRIVILEGES ON DATABASE collab TO collab;
\q
EOF

# 执行初始化脚本
PGPASSWORD=20050430 psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/init.sql
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
            "passwd": "20050430",
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

## 🔒 安全特性

- **密码加密**：使用 SHA-256 + 随机盐值（16 字节）
- **JWT 认证**：短期 access_token（15 分钟）+ 长期 refresh_token（30 天）
- **参数化查询**：防止 SQL 注入攻击
- **输入验证**：邮箱格式、密码强度检查

## 📚 文档

- **[总体设计文档](./docs/总体设计.md)** - 系统架构、模块划分、开发路线图
- **[详细设计文档](./docs/详细设计.md)** - 数据库设计、API 规格、代码结构、部署指南
- [第一阶段开发指南](./docs/第一阶段开发指南.md) - 用户认证与基础功能
- **[第二阶段开发指南](./docs/第二阶段开发指南.md)** - 文档 CRUD、权限管理与版本控制
- [开发提示与最佳实践](./docs/开发提示与最佳实践.md)
- [后端 API 测试方法](./docs/后端API测试方法.md)

## 🐛 常见问题

### 数据库连接失败

1. 检查 PostgreSQL 服务是否运行：`sudo service postgresql status`
2. 验证数据库和用户是否存在：`psql -U collab -d collab -c "\conninfo"`
3. 确认 `config.json` 中的连接信息正确
4. 检查防火墙设置

### 编译错误

- **找不到 Drogon**：确保已正确编译安装 Drogon，并设置 `DROGON_INSTALL_PREFIX`
- **找不到 jwt-cpp**：确保已安装 jwt-cpp 到 `/usr/local`
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

### 🔄 第二阶段（进行中）

- [ ] 文档 CRUD 接口
- [ ] 文档权限管理（ACL）
- [ ] 用户资料管理
- [ ] 文档版本管理

### 📅 第三阶段（计划中）

- [ ] 实时协作接入（Yjs + WebSocket）
- [ ] 评论系统
- [ ] 任务管理
- [ ] 通知系统
- [ ] 全文搜索

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[待定]

## 👥 作者

[待补充]

---

**注意**：本项目正在积极开发中，API 可能会有变更。请参考最新文档获取最新信息。
