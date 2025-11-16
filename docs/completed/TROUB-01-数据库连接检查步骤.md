# 数据库连接检查步骤

## 问题诊断结果

根据诊断脚本，发现的主要问题：

1. ✅ PostgreSQL 服务正在运行
2. ✅ 数据库连接测试成功（使用 psql）
3. ✅ 数据库表结构已初始化
4. ❌ Drogon 无法连接到数据库（显示 "disconnected"）

## 根本原因

**配置文件路径问题**：服务从 `build/` 目录运行，但 `config.json` 不在该目录，导致 Drogon 无法加载数据库配置。

## 解决步骤

### 1. 确认配置文件位置

```bash
cd /home/dracarys/projects/MultiuserDocument
ls -la cpp-service/build/config.json
```

如果文件不存在，执行：

```bash
cp cpp-service/config.json cpp-service/build/config.json
```

### 2. 重启服务

```bash
# 停止当前服务（如果在运行）
pkill -f cpp-service

# 重新编译（如果修改了代码）
cd cpp-service/build
cmake ..
make -j$(nproc)

# 启动服务
./cpp-service
```

### 3. 验证数据库连接

```bash
# 检查健康状态
curl http://localhost:8080/health

# 应该看到：
# {
#     "database": "connected",  ← 这里应该是 connected
#     "service": "cpp-service",
#     "status": "ok"
# }
```

### 4. 测试注册接口

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test12345",
    "nickname": "测试用户"
  }'
```

## 其他可能的问题

### 如果重启后仍然显示 "disconnected"

#### 检查1：数据库和用户是否存在

```bash
# 检查数据库
psql -h 127.0.0.1 -p 5432 -U postgres -c "\l" | grep collab

# 检查用户
psql -h 127.0.0.1 -p 5432 -U postgres -c "\du" | grep collab
```

如果不存在，创建它们：

```bash
sudo -u postgres psql << EOF
CREATE DATABASE collab;
CREATE USER collab WITH PASSWORD 'collab_pass';
GRANT ALL PRIVILEGES ON DATABASE collab TO collab;
\q
EOF
```

#### 检查2：测试数据库连接

```bash
export PGPASSWORD='collab_pass'
psql -h 127.0.0.1 -p 5432 -U collab -d collab -c "SELECT 1;"
unset PGPASSWORD
```

#### 检查3：检查配置文件语法

```bash
cd cpp-service/build
cat config.json | python3 -m json.tool
```

确保 `rdbms` 配置正确：

```json
{
  "rdbms": [
    {
      "name": "default",
      "rdbms": "postgresql",
      "host": "127.0.0.1",
      "port": 5432,
      "dbname": "collab",
      "user": "collab",
      "passwd": "collab_pass",
      "is_fast": true,
      "characterSet": "utf8"
    }
  ]
}
```

#### 检查4：查看服务启动日志

```bash
# 检查是否有错误信息
# 服务启动时应该输出配置文件路径
```

#### 检查5：检查 PostgreSQL 认证配置

```bash
# 检查 pg_hba.conf
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep -E "^[^#]" | head -5
```

确保有类似这样的配置：

```.
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
```

## 快速诊断脚本

运行诊断脚本：

```bash
cd /home/dracarys/projects/MultiuserDocument
./check_db_connection.sh
```

## 常见错误信息

| 错误信息 | 可能原因 | 解决方法 |
|---------|---------|---------|
| `Database not available` | Drogon 未加载数据库配置 | 确保 `config.json` 在运行目录 |
| `connection refused` | PostgreSQL 未运行 | `sudo service postgresql start` |
| `authentication failed` | 用户名或密码错误 | 检查 `config.json` 中的凭据 |
| `database does not exist` | 数据库未创建 | 执行数据库创建命令 |
