# 步骤 3 完成：前端编辑器集成

## 已完成的工作

### 1. 工具函数
- ✅ 创建了 `src/utils/snapshot.ts`
  - `calculateSHA256()`: 计算 SHA256 哈希值
  - `uploadSnapshot()`: 上传快照到 MinIO（目前使用占位符实现）

### 2. API 客户端更新
- ✅ 在 `src/api/client.ts` 中添加了协作相关方法：
  - `getCollaborationToken(docId)`: 获取协作令牌
  - `getBootstrap(docId)`: 获取引导快照
  - `saveSnapshot(docId, data)`: 保存快照

### 3. 编辑器组件
- ✅ 创建了 `src/components/DocumentEditor.tsx`
  - 集成 Tiptap 编辑器
  - 集成 Yjs 进行实时协作
  - 集成 y-websocket 进行 WebSocket 连接
  - 支持快照加载和自动保存
  - 显示连接状态

### 4. 编辑器页面
- ✅ 创建了 `src/pages/DocumentEditorPage.tsx`
  - 文档加载和错误处理
  - 集成 DocumentEditor 组件
  - 显示保存提示

### 5. 路由配置
- ✅ 更新了 `src/App.tsx`
  - 添加了 `/docs/:id/edit-content` 路由

### 6. 文档详情页更新
- ✅ 更新了 `src/pages/DocumentDetailPage.tsx`
  - 添加了"编辑内容"按钮
  - 保留了"编辑信息"按钮

### 7. 环境变量配置
- ✅ 创建了 `.env.example` 文件
  - `VITE_API_BASE_URL`: API 基础 URL
  - `VITE_WS_URL`: WebSocket 服务器 URL

## 使用说明

### 1. 环境变量配置
在 `frontend` 目录下创建 `.env` 文件（参考 `.env.example`）：
```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:1234
```

### 2. 启动前端服务
```bash
cd frontend
npm install
npm run dev
```

### 3. 访问编辑器
1. 登录系统
2. 进入文档详情页
3. 点击"编辑内容"按钮
4. 开始编辑文档

## 注意事项

### 1. 依赖项
确保已安装以下依赖：
- `@tiptap/react`: ^3.10.5
- `@tiptap/starter-kit`: ^3.10.5
- `@tiptap/extension-placeholder`: ^3.10.5
- `yjs`: ^13.6.27
- `y-websocket`: ^3.0.0
- `y-prosemirror`: ^1.3.7

### 2. 后端要求
编辑器需要后端提供以下接口：
- `POST /api/collab/token`: 获取协作令牌
- `GET /api/collab/bootstrap/:id`: 获取引导快照
- `POST /api/collab/snapshot/:id`: 保存快照

### 3. WebSocket 服务器
需要运行 y-websocket 服务器（参考步骤 1）：
- 默认地址：`ws://localhost:1234`
- 可通过环境变量 `VITE_WS_URL` 配置

### 4. 快照上传
目前 `uploadSnapshot()` 函数使用占位符实现。在生产环境中，需要：
1. 实现实际上传到 MinIO 的逻辑
2. 或者调用后端上传接口
3. 或者使用 presigned URL 直接上传

### 5. 错误处理
编辑器包含基本的错误处理：
- 协作连接失败时，允许本地编辑
- 快照加载失败时，从空文档开始
- 显示连接状态提示

## 下一步

1. **实现快照上传**
   - 集成 MinIO 客户端
   - 或实现后端上传接口

2. **测试协作功能**
   - 打开多个浏览器窗口
   - 测试实时同步
   - 测试光标位置显示

3. **优化编辑器**
   - 添加更多 Tiptap 扩展
   - 优化样式
   - 添加工具栏

4. **错误处理改进**
   - 添加重连机制
   - 改进错误提示
   - 添加离线支持

## 已知问题

1. **快照上传未实现**
   - 当前使用占位符
   - 需要实现实际上传逻辑

2. **编辑器样式**
   - 移除了 prose 类（需要安装 @tailwindcss/typography）
   - 可以添加自定义样式

3. **Yjs 集成**
   - 需要在编辑器初始化后配置插件
   - 可能存在时序问题

## 测试建议

1. **单用户测试**
   - 创建文档
   - 编辑内容
   - 检查自动保存

2. **多用户测试**
   - 打开多个浏览器窗口
   - 同时编辑同一文档
   - 检查实时同步

3. **错误测试**
   - 断开 WebSocket 连接
   - 测试错误处理
   - 检查重连机制

