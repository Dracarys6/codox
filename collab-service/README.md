# 协作服务 (collab-service)

基于 Yjs 和 WebSocket 的实时协作文档服务，为前端提供多人实时编辑能力。

## 📋 功能简介

本服务实现了 Yjs 的 WebSocket 网关，负责：

- 处理前端 WebSocket 连接
- 管理文档的实时协作状态
- 同步多个客户端的编辑操作
- 支持文档的实时协作编辑

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

服务配置在 `server.ts` 中：

```typescript
const wss = new WebSocketServer({ port: 1234 });
```

可以通过环境变量或命令行参数修改端口：

```bash
PORT=3000 npm start
```

## 🔌 WebSocket 协议

### 连接方式

前端通过 WebSocket 连接到服务：

```
ws://localhost:1234?docId=123&token=your-jwt-token
```

### 连接参数

- `docId`: 文档 ID（必需）
- `token`: JWT 认证令牌（可选，当前版本未验证）

### 使用示例

前端连接示例（来自 `frontend/src/components/DocumentEditor.tsx`）：

```typescript
const wsUrl = `${import.meta.env.VITE_WS_URL}?docId=${docId}&token=${token}`;
const ws = new WebSocket(wsUrl);

// Yjs 会自动处理消息同步
```

## 🔧 配置说明

### 环境变量

可以通过环境变量配置服务：

- `PORT`: WebSocket 服务端口（默认: 1234）

### 前端配置

前端需要在 `.env` 文件中配置 WebSocket 地址：

```env
VITE_WS_URL=ws://localhost:1234
```

## 🧪 测试

### 手动测试

1. 启动服务：
   ```bash
   npm start
   ```

2. 使用 WebSocket 客户端测试连接：
   ```bash
   # 使用 wscat（需要先安装: npm install -g wscat）
   wscat -c "ws://localhost:1234?docId=123&token=test"
   ```

3. 在前端打开多个浏览器标签页，编辑同一文档，验证实时同步

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
- 检查前端 `.env` 中的 `VITE_WS_URL` 配置
- 检查防火墙设置
- 查看浏览器控制台的错误信息

### 协作不同步

- 确保所有客户端连接到同一个 `docId`
- 检查 Yjs 版本是否一致
- 查看服务日志是否有错误

## 🔒 安全注意事项

⚠️ **当前版本未实现 Token 验证**

`server.ts` 中有 TODO 注释：

```typescript
// TODO: 验证 token（从业务后端验证）
```

**建议在生产环境中实现：**

1. 从 URL 参数中提取 `token`
2. 向 C++ 后端服务验证 Token 有效性
3. 验证用户是否有权限访问该文档
4. 拒绝无效或未授权的连接

示例实现：

```typescript
import axios from 'axios';

async function validateToken(token: string, docId: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `http://localhost:8080/api/collab/token/${docId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// 在连接处理中使用
if (token && !await validateToken(token, docId)) {
  ws.close(1008, 'Invalid token');
  return;
}
```

## 📚 相关文档

- [项目启动指南](../docs/GUIDE-01-项目启动指南.md)
- [第三阶段开发指南](../docs/PHASE-03-协作功能开发指南.md)
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

