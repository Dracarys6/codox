# 协作服务 (collab-service)

基于 Yjs 和 WebSocket 的实时协作文档服务，为前端提供多人实时编辑能力，并负责通知通道。

## 📋 功能简介

本服务实现了 Yjs 的 WebSocket 网关，同时承担通知推送通道，负责：

- 处理前端 WebSocket 连接
- 管理文档的实时协作状态
- 同步多个客户端的编辑操作
- 支持文档的实时协作编辑
- 维持通知 WebSocket，供后端主动推送事件

## 🛠️ 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **WebSocket**: ws
- **协作框架**: Yjs (@y/websocket-server)
- **构建工具**: tsx

## 📁 项目结构

```
collab-service/
├── server.ts              # 主服务文件
├── package.json           # 依赖配置
├── tsconfig.json          # TypeScript 配置
└── README.md              # 本文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd collab-service
npm install
```

### 2. 启动服务

```bash
# 开发模式
npm run dev
# 或
npm start

# 生产模式（需要先编译）
npm run build
node dist/server.js
```

服务默认运行在 `ws://localhost:1234`

### 3. 配置

服务主要通过环境变量配置：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | WebSocket 服务端口 | `1234` |
| `COLLAB_JWT_SECRET` | 用于验证协作令牌与通知令牌的 JWT Secret（必须与 C++ 服务一致） | `default-secret` |

```bash
COLLAB_JWT_SECRET="your-secret" npm start
```

## 🔌 WebSocket 协议

### 连接方式

前端通过 WebSocket 连接到服务：

```
ws://localhost:1234?docId=123&token=your-jwt-token
```

### 连接参数

- `docId`: 文档 ID（必需）
- `token`: 协作 JWT 令牌（必需，服务端会验证）
 
## 🔔 通知通道

- **地址**：`ws://localhost:1234/ws/notifications?token=<access_token>`
- **验证**：使用 `cpp-service` 颁发的 Access Token，payload 必须包含 `user_id`
- **多端支持**：同一账号可在多个标签页/设备保持在线，服务端自动管理连接集合
- **前端配置**：`VITE_NOTIFICATION_WS_URL` 可覆盖默认地址，否则回退到 `/ws/notifications`

成功连接后服务会推送 `Notification channel connected` 消息，并在连接关闭时自动清理。

## 🔧 配置说明

### 环境变量

可以通过环境变量配置服务：

- `PORT`: WebSocket 服务端口（默认: 1234）
- `COLLAB_JWT_SECRET`: 协作令牌验证用的 Secret（默认: `default-secret`）

### 前端配置

前端需要在 `.env` 文件中配置协作 WebSocket 地址：

```env
# 协作 WebSocket（Yjs + 通知）
VITE_WS_URL=ws://localhost:1234
```

## 🧪 测试

### 手动测试

1. 启动服务：
   ```bash
   npm start
   ```

2. 使用 WebSocket 客户端测试协作连接：
   ```bash
   # 使用 wscat（需要先安装: npm install -g wscat）
   wscat -c "ws://localhost:1234?docId=xxx&token=YOUR_ACCESS_TOKEN"
   ```

3. 在前端打开多个浏览器标签页，编辑同一文档，验证实时同步和通知推送

### 集成测试

协作服务需要与以下服务配合使用：

- **C++ 后端服务**: 提供协作令牌和文档信息
- **前端服务**: 使用 Yjs 编辑器连接 WebSocket

完整的测试流程请参考 `docs/项目启动指南.md`

## 🐛 常见问题

### 端口被占用

```bash
# 检查端口占用
sudo lsof -i :1234

# 修改端口（在 server.ts 中或使用环境变量）
PORT=3000 npm start
```

### WebSocket 连接失败

- 检查服务是否正在运行
- 检查前端 `.env` 中的 `VITE_WS_URL`（协作）配置
- 检查防火墙设置
- 查看浏览器控制台的错误信息

### 协作不同步

- 确保所有客户端连接到同一个 `docId`
- 检查 Yjs 版本是否一致
- 查看服务日志是否有错误

## 🔒 安全注意事项

- 协作/通知 WebSocket 必须携带合法的 `docId`（协作）或 `token`（通知）
- `server.ts` 会使用 `COLLAB_JWT_SECRET` 验证令牌；协作令牌需要 `type='collab'` 且 `doc_id` 与 `docId` 一致
- 通知令牌会解析 `user_id`，若字段缺失或无效会直接拒绝连接
- 验证失败会返回 `1008 Policy Violation` 并拒绝连接
- 建议将 `COLLAB_JWT_SECRET` 配置为与 C++ 服务相同的 `jwt_secret`
- 如需进一步加固，可在验证成功后向 C++ 服务发起二次权限校验

## 📚 相关文档

- [总体设计文档](../docs/ARCH-01-总体设计.md)
- [API 设计文档](../docs/API-01-API设计.md)
- [项目启动指南](../docs/GUIDE-01-项目启动指南.md)
- [Yjs 官方文档](https://docs.yjs.dev/)
- [@y/websocket-server 文档](https://github.com/yjs/y-websocket)

## 🔄 与前端集成

前端使用 Tiptap 编辑器配合 Yjs 实现实时协作：

1. **获取协作令牌**: 从 C++ 后端获取 JWT Token
2. **建立 WebSocket 连接**: 使用 Token 和文档 ID 连接本服务
3. **初始化 Yjs 文档**: 创建 Yjs 文档并绑定到 Tiptap
4. **同步编辑**: Yjs 自动处理多客户端同步

详细的前端集成代码请参考 `frontend/src/components/DocumentEditor.tsx`

---

**注意**: 本服务是 Codox 项目的协作服务，需要与 C++ 后端服务和前端配合使用。在生产环境中，建议实现 Token 验证和权限检查。
