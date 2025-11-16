# 后端 API 测试方法指南

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



## 第三阶段 API（协作/评论/任务/通知/搜索）测试指南

> 以下示例统一使用 HTTPie，默认后端运行在 `http://localhost:8080`，测试账号为 `test@example.com / test12345`。执行命令前建议 `cd` 到仓库根目录。

### 第一步：登录并保存 Token

```bash
# 登录
http --ignore-stdin POST :localhost:8080/api/auth/login \
  account=test@example.com password=test12345

# 将 access_token/export 为环境变量
export ACCESS_TOKEN="粘贴上一步返回的 access_token"
```

> 说明：HTTPie 在使用 `key=value` 语法时需要带上 `--ignore-stdin`，否则若命令位于脚本或管道后会报 “Request body and request data cannot be mixed”。

### 协作接口

```bash
# 获取协作令牌
http --ignore-stdin POST :8080/api/collab/token \
  Authorization:"Bearer $ACCESS_TOKEN" doc_id:=12

# 获取引导快照
http --ignore-stdin GET :8080/api/collab/bootstrap/12 \
  Authorization:"Bearer $ACCESS_TOKEN"

# 模拟快照回调（需正确 X-Webhook-Token）
http --ignore-stdin POST :8080/api/collab/snapshot/12 \
  X-Webhook-Token:7f9e2d4c-8b3a-41e0-9c6f-5d873a2b9c1e \
  snapshot_url=http://example.com/snapshot \
  sha256=dummy-hash \
  size_bytes:=123
```

建议同时测试以下异常场景：缺少 `doc_id`、`Authorization`、使用无权限用户、错误的 `X-Webhook-Token`、重复 `sha256`（幂等返回）。

### 评论接口

```bash
# 列出评论
http --ignore-stdin GET :8080/api/docs/12/comments \
  Authorization:"Bearer $ACCESS_TOKEN"

# 创建评论
http --ignore-stdin POST :8080/api/docs/12/comments \
  Authorization:"Bearer $ACCESS_TOKEN" \
  content='这是一条评论'

# 删除评论
http --ignore-stdin DELETE :8080/api/comments/123 \
  Authorization:"Bearer $ACCESS_TOKEN"
```

重点验证：内容为空、`parent_id` 非法、无权限删除时的 400/403 响应，并在数据库检查 `comment`、`notification` 表是否同步更新。

### 任务接口

```bash
# 获取任务列表
http --ignore-stdin GET :8080/api/docs/12/tasks \
  Authorization:"Bearer $ACCESS_TOKEN"

# 创建任务（需要 editor 权限）
http --ignore-stdin POST :8080/api/docs/12/tasks \
  Authorization:"Bearer $ACCESS_TOKEN" \
  title='编写测试用例' assignee_id:=1

# 更新任务状态
http --ignore-stdin PATCH :8080/api/tasks/456 \
  Authorization:"Bearer $ACCESS_TOKEN" \
  status=doing

# 删除任务
http --ignore-stdin DELETE :8080/api/tasks/456 \
  Authorization:"Bearer $ACCESS_TOKEN"
```

需补充：缺少 title、assignee、非法 status 以及非创建者/文档所有者操作时的拒绝行为，同时确认任务相关通知写入 `notification`。

### 通知接口

```bash
# 拉取通知列表
http --ignore-stdin GET :8080/api/notifications \
  Authorization:"Bearer $ACCESS_TOKEN" \
  page==1 page_size==20 unread_only==false

# 批量标记为已读
http --ignore-stdin POST :8080/api/notifications/read \
  Authorization:"Bearer $ACCESS_TOKEN" \
  notification_ids:='[1,2]'

# 未读数量
http --ignore-stdin GET :8080/api/notifications/unread-count \
  Authorization:"Bearer $ACCESS_TOKEN"
```

重点覆盖：空数组、包含其他用户通知 ID、`unread_only` 过滤等情形。

### 搜索接口（若已开放）

```bash
# 文档搜索
http --ignore-stdin GET :8080/api/search \
  Authorization:"Bearer $ACCESS_TOKEN" \
  q=='协作' page==1 page_size==20
```

应验证：缺少 `q` 返回 400、返回结果仅包含当前用户有权限的文档，以及不同权限用户的可见性差异。

### WebSocket / 协作链路

1. 使用 `wscat`/`websocat` 连接协作服务：  
   `wscat -c "ws://localhost:1234?docId=12&token=<getToken返回的token>"`
2. 同时在两个窗口输入内容，确认 Yjs 同步正常。  
3. 断网或关闭其中一个连接，观察 `DocumentEditor` 是否触发快照并通过 `/api/collab/snapshot/{id}` 回调。

---