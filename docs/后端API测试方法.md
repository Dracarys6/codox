# 后端 API 测试方法指南

本文档介绍如何使用各种工具测试后端 API，包括发送 GET/POST 请求、调试技巧等。

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
