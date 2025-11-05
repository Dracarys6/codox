# 后端 API 测试方法指南

本文档介绍如何使用各种工具测试后端 API，包括发送 GET/POST 请求、调试技巧等。

## 目录

1. [使用 curl 测试](#使用-curl-测试)
2. [使用 HTTPie 测试](#使用-httpie-测试)
3. [使用 Postman 测试](#使用-postman-测试)
4. [测试脚本示例](#测试脚本示例)
5. [调试技巧](#调试技巧)
6. [常见问题排查](#常见问题排查)

---

## 使用 curl 测试

`curl` 是最常用的命令行 HTTP 客户端，几乎所有 Linux/Unix 系统都预装了它。

### 基本语法

```bash
curl [选项] <URL>
```

### 常用选项

| 选项 | 说明 |
|------|------|
| `-X <METHOD>` | 指定 HTTP 方法（GET, POST, PUT, PATCH, DELETE） |
| `-H "Header: Value"` | 添加 HTTP 头部 |
| `-d 'data'` | 发送 POST 数据（表单格式） |
| `-d @file.json` | 从文件读取 POST 数据 |
| `--data-raw 'json'` | 发送原始 JSON 数据 |
| `-v` | 详细输出（显示请求和响应头） |
| `-i` | 显示响应头 |
| `-s` | 静默模式（不显示进度） |
| `-o file` | 将输出保存到文件 |

### GET 请求示例

```bash
# 基本 GET 请求
curl http://localhost:8080/health

# 格式化 JSON 输出（需要 jq 或 python）
curl -s http://localhost:8080/health | python3 -m json.tool
curl -s http://localhost:8080/health | jq

# 带认证头的 GET 请求
curl -X GET http://localhost:8080/api/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 显示详细信息
curl -v http://localhost:8080/health
```

### POST 请求示例

```bash
# POST JSON 数据
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}'

# 从文件读取 JSON 数据
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d @login.json

# 格式化输出
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | python3 -m json.tool
```

### PATCH 请求示例

```bash
# PATCH 请求更新用户信息
curl -X PATCH http://localhost:8080/api/users/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"新昵称","bio":"个人简介"}'
```

### 保存和使用 Token

```bash
# 登录并保存 token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

echo "Token: $TOKEN"

# 使用保存的 token
curl -X GET http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

### 完整测试流程示例

```bash
#!/bin/bash

# 1. 健康检查
echo "=== 1. 健康检查 ==="
curl -s http://localhost:8080/health | python3 -m json.tool

# 2. 用户注册
echo -e "\n=== 2. 用户注册 ==="
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"password123"}' \
  | python3 -m json.tool

# 3. 用户登录
echo -e "\n=== 3. 用户登录 ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}')

echo "$LOGIN_RESPONSE" | python3 -m json.tool

# 提取 token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Token: ${TOKEN:0:50}..."

# 4. 获取用户信息
echo -e "\n=== 4. 获取用户信息 ==="
curl -s -X GET http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

# 5. 更新用户信息
echo -e "\n=== 5. 更新用户信息 ==="
curl -s -X PATCH http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"测试昵称","bio":"这是个人简介"}' \
  | python3 -m json.tool

# 6. 验证更新
echo -e "\n=== 6. 验证更新 ==="
curl -s -X GET http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

---

## 使用 HTTPie 测试

HTTPie 是一个更友好的命令行 HTTP 客户端，语法更简洁。

### 1.安装

```bash
# Ubuntu/Debian
sudo apt install httpie

# macOS
brew install httpie

# pip
pip install httpie
```

### 2.基本语法

```bash
http <METHOD> <URL> [选项]
```

### 3.GET 请求示例

```bash
# 基本 GET 请求
http GET http://localhost:8080/health

# 带认证头
http GET http://localhost:8080/api/users/me \
  Authorization:"Bearer <token>"
```

### 4.POST 请求示例

```bash
# POST JSON 数据（自动添加 Content-Type）
http POST http://localhost:8080/api/auth/login \
  account="test@example.com" \
  password="test12345"

# 格式化输出
http POST http://localhost:8080/api/auth/login \
  account="test@example.com" \
  password="test12345" \
  --pretty=format
```

### 完整示例

```bash
# 登录
http POST http://localhost:8080/api/auth/login \
  account="test@example.com" \
  password="test12345"

# 获取用户信息
http GET http://localhost:8080/api/users/me \
  Authorization:"Bearer <token>"

# 更新用户信息
http PATCH http://localhost:8080/api/users/me \
  Authorization:"Bearer <token>" \
  nickname="新昵称" \
  bio="个人简介"
```

---

## 使用 Postman 测试

Postman 是图形化的 API 测试工具，适合复杂场景和团队协作。

### 安装

访问 [Postman 官网](https://www.postman.com/downloads/) 下载安装。

### 基本使用

1. **创建请求**
   - 点击 "New" -> "HTTP Request"
   - 选择方法（GET, POST, PATCH 等）
   - 输入 URL：`http://localhost:8080/api/auth/login`

2. **设置请求头**
   - 点击 "Headers" 标签
   - 添加 `Content-Type: application/json`
   - 添加 `Authorization: Bearer <token>`

3. **设置请求体（POST/PATCH）**
   - 点击 "Body" 标签
   - 选择 "raw" 和 "JSON"
   - 输入 JSON 数据：

   ```json
   {
     "account": "test@example.com",
     "password": "test12345"
   }
   ```

4. **发送请求**
   - 点击 "Send" 按钮
   - 查看响应结果

### 保存 Token

1. **使用 Tests 标签自动保存 Token**

   ```javascript
   // 在登录请求的 Tests 标签中添加：
   var jsonData = pm.response.json();
   pm.environment.set("access_token", jsonData.access_token);
   ```

2. **在后续请求中使用**
   - 在 Authorization 中使用变量：`Bearer {{access_token}}`

### 创建 Collection

1. 创建新的 Collection
2. 添加多个请求到 Collection
3. 可以设置环境变量（Environment）
4. 可以批量运行所有请求

---

## 测试脚本示例

### 完整测试脚本

创建文件 `test-api.sh`：

```bash
#!/bin/bash

BASE_URL="http://localhost:8080"
EMAIL="test@example.com"
PASSWORD="test12345"

echo "=== API 测试脚本 ==="
echo ""

# 1. 健康检查
echo "1. 健康检查"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

# 2. 登录
echo "2. 用户登录"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"account\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if [ $? -ne 0 ]; then
  echo "登录失败"
  exit 1
fi

echo "$LOGIN_RESPONSE" | python3 -m json.tool
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
  echo "无法获取 token"
  exit 1
fi

echo "Token 获取成功: ${TOKEN:0:50}..."
echo ""

# 3. 获取用户信息
echo "3. 获取用户信息"
curl -s -X GET "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
echo ""

# 4. 更新用户信息
echo "4. 更新用户信息"
curl -s -X PATCH "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"测试昵称","bio":"这是个人简介"}' \
  | python3 -m json.tool
echo ""

# 5. 验证更新
echo "5. 验证更新"
curl -s -X GET "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
echo ""

echo "=== 测试完成 ==="
```

使用方法：

```bash
chmod +x test-api.sh
./test-api.sh
```

### Python 测试脚本

创建文件 `test_api.py`：

```python
#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8080"
EMAIL = "test@example.com"
PASSWORD = "test12345"

def print_json(data):
    """格式化打印 JSON"""
    print(json.dumps(data, indent=2, ensure_ascii=False))

def test_health():
    """测试健康检查"""
    print("=== 1. 健康检查 ===")
    response = requests.get(f"{BASE_URL}/health")
    print_json(response.json())
    print()

def test_login():
    """测试登录"""
    print("=== 2. 用户登录 ===")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"account": EMAIL, "password": PASSWORD}
    )
    data = response.json()
    print_json(data)
    token = data.get("access_token")
    print(f"\nToken: {token[:50]}...")
    print()
    return token

def test_get_user(token):
    """测试获取用户信息"""
    print("=== 3. 获取用户信息 ===")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
    print_json(response.json())
    print()

def test_update_user(token):
    """测试更新用户信息"""
    print("=== 4. 更新用户信息 ===")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "nickname": "测试昵称",
        "bio": "这是个人简介"
    }
    response = requests.patch(
        f"{BASE_URL}/api/users/me",
        headers=headers,
        json=data
    )
    print_json(response.json())
    print()

if __name__ == "__main__":
    test_health()
    token = test_login()
    test_get_user(token)
    test_update_user(token)
    test_get_user(token)  # 验证更新
```

使用方法：

```bash
chmod +x test_api.py
python3 test_api.py
```

---

## 调试技巧

### 1. 查看详细请求信息

使用 `curl -v` 查看完整的请求和响应：

```bash
curl -v -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}'
```

### 2. 查看服务器日志

```bash
# 查看服务日志
tail -f /home/dracarys/projects/MultiuserDocument/cpp-service/build/service.log

# 查看 Drogon 日志
tail -f /home/dracarys/projects/MultiuserDocument/cpp-service/build/logs/*.log
```

### 3. 测试错误场景

```bash
# 测试无效 token
curl -X GET http://localhost:8080/api/users/me \
  -H "Authorization: Bearer invalid_token"

# 测试缺少认证头
curl -X GET http://localhost:8080/api/users/me

# 测试无效 JSON
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com"'
```

### 4. 使用 jq 处理 JSON

```bash
# 安装 jq
sudo apt install jq

# 提取特定字段
curl -s http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | jq '.access_token'

# 格式化并过滤
curl -s http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{id, email, profile: .profile.nickname}'
```

### 5. 验证 HTTP 状态码

```bash
# 只显示状态码
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health

# 检查状态码并执行不同操作
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "服务正常"
else
  echo "服务异常: $HTTP_CODE"
fi
```

---

## 常见问题排查

### 1. 连接拒绝（Connection refused）

**错误：** `curl: (7) Failed to connect to localhost port 8080: Connection refused`

**原因：** 服务未启动

**解决：**

```bash
# 检查服务是否运行
ps aux | grep cpp-service

# 启动服务
cd /home/dracarys/projects/MultiuserDocument/cpp-service/build
./cpp-service
```

### 2. 401 Unauthorized

**错误：** `{"error": "Unauthorized"}` 或 `{"error": "Missing Authorization header"}`

**原因：** Token 无效或缺失

**解决：**

```bash
# 重新登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

# 检查 token 是否有效
echo "Token: $TOKEN"
```

### 3. 400 Bad Request

**错误：** `{"error": "Invalid JSON"}`

**原因：** JSON 格式错误

**解决：**

```bash
# 检查 JSON 格式
echo '{"account":"test@example.com","password":"test12345"}' | python3 -m json.tool

# 使用单引号包裹 JSON，内部使用双引号
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}'
```

### 4. 500 Internal Server Error

**错误：** `{"error": "Database error: ..."}`

**原因：** 数据库连接问题或查询错误

**解决：**

```bash
# 检查数据库连接
curl -s http://localhost:8080/health | python3 -m json.tool

# 查看服务日志
tail -50 /home/dracarys/projects/MultiuserDocument/cpp-service/build/service.log
```

### 5. 中文乱码

**问题：** JSON 中的中文显示为 Unicode 编码

**解决：**

```bash
# 使用 python3 -m json.tool 会自动解码
curl -s http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

# 或者使用 jq
curl -s http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

---

## API 端点测试清单

### 认证相关

- [ ] `GET /health` - 健康检查
- [ ] `POST /api/auth/register` - 用户注册
- [ ] `POST /api/auth/login` - 用户登录
- [ ] `POST /api/auth/refresh` - 刷新 Token

### 用户相关

- [ ] `GET /api/users/me` - 获取当前用户信息（需要认证）
- [ ] `PATCH /api/users/me` - 更新当前用户信息（需要认证）

### 测试命令模板

```bash
# 设置变量
BASE_URL="http://localhost:8080"
TOKEN="your_token_here"

# 健康检查
curl -s "$BASE_URL/health" | python3 -m json.tool

# 登录
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | python3 -m json.tool

# 需要认证的请求
curl -s -X GET "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

---

## 总结

### 推荐工具选择

- **快速测试：** curl
- **日常使用：** HTTPie（语法更友好）
- **复杂场景：** Postman（图形界面，支持集合和环境变量）
- **自动化测试：** Python requests 库

### 最佳实践

1. **保存 Token**：使用环境变量或脚本变量保存 token
2. **格式化输出**：使用 `python3 -m json.tool` 或 `jq` 格式化 JSON
3. **查看日志**：遇到问题时查看服务日志
4. **测试错误场景**：测试各种错误情况，确保错误处理正确
5. **创建测试脚本**：将常用测试命令保存为脚本，方便重复使用

---

## 参考资料

- [curl 官方文档](https://curl.se/docs/)
- [HTTPie 文档](https://httpie.io/docs)
- [Postman 文档](https://learning.postman.com/)
- [Python requests 文档](https://docs.python-requests.org/)
