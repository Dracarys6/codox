# 前端使用指南（2025.11 Release）

React 18 + Vite + Tiptap 的协作文档前端，覆盖文档编辑、权限/版本、评论任务、通知中心、管理员运营面板与文档导入导出等全部功能。

## 核心能力
- 🔐 **认证**：注册/登录、Token 自动刷新、受保护路由、个人资料管理
- 📄 **文档工作区**：列表、筛选、标签、状态切换、协作者管理（`AclManager`）
- ✏️ **协作编辑**：`DocumentEditor` + Yjs，实时光标、快照引导、MinIO 快照回放
- 💬 **评论 / 任务**：侧边面板与任务看板联动通知
- 🔔 **通知中心**：筛选（类型/文档/时间/未读）、WebSocket 实时提醒（`useNotificationWebSocket`）
- 🕑 **版本时间线**：`VersionTimeline`、`VersionDiffView` 支持手动版本、Diff、恢复
- 🧰 **导入导出**：`ImportModal` / `ExportMenu` 调用 `doc-converter-service`
- 🧑‍💼 **管理员面板**：`AdminUsersPage`、`AnalyticsDashboard`、满意度报表、CSV 导出

## 快速开始
```bash
# 1. 安装依赖（Node.js 18+）
npm install

# 2. 配置环境变量
cp .env.local.example .env.local  # 若仓库提供示例
# 如果没有示例，可直接新建
touch .env.local
```

`.env.local` 推荐内容：
```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:1234
VITE_NOTIFICATION_WS_URL=ws://localhost:1234/ws/notifications
```

```bash
# 3. 启动开发服务器（http://localhost:3000，已在 vite.config.ts 中配置代理）
npm run dev

# 4. 构建 & 预览
npm run build
npm run preview

# 5. Lint（CI 同步使用）
npm run lint
```

## 目录速览
```
frontend/
├── src/api/client.ts            # Axios 封装 + Token 刷新
├── src/components/
│   ├── DocumentEditor.tsx       # Yjs + Tiptap 协作编辑器
│   ├── VersionTimeline.tsx      # 版本时间线与筛选
│   ├── VersionDiffView.tsx      # 差异对比
│   ├── ImportModal.tsx          # 导入 UI
│   ├── ExportMenu.tsx           # 导出按钮组
│   ├── CommentPanel.tsx / TaskPanel.tsx
│   ├── AclManager.tsx           # 协作者管理
│   └── feedback/*               # 满意度收集组件
├── src/hooks/useNotificationWebSocket.ts
├── src/pages/
│   ├── DocumentsPage.tsx
│   ├── EditorPage.tsx
│   ├── VersionManagementPage.tsx
│   ├── NotificationsPage.tsx
│   ├── SearchPage.tsx
│   ├── AdminUsersPage.tsx
│   └── HomePage.tsx             # 统计卡片 + 快捷操作
├── src/contexts/AuthContext.tsx
├── src/types/index.ts           # DTO & API 类型
├── tailwind.config.js / postcss.config.js
└── vite.config.ts               # dev server 端口 & 代理
```

## 主要模块
- **API 客户端**：`src/api/client.ts` 统一处理 Token 注入、刷新、错误拦截，并暴露文档/协作/管理员/反馈等类型安全方法。
- **认证与导航**：`AuthContext` + `ProtectedRoute` 控制访问；`Navbar` 集成通知铃、搜索、管理员入口。
- **编辑器**：`DocumentEditor` 支持协作光标、富文本工具栏、导出按钮、任务/评论联动。
- **通知**：`NotificationsPage` + WebSocket Hook 提供实时推送、批量已读、类型/文档/日期过滤。
- **版本中心**：`VersionManagementPage` 调用版本增强 API，提供 Diff 预览、恢复、过滤器。
- **管理员中心**：`AdminUsersPage`（列表、筛选、CSV 导出、角色/状态编辑）、`AnalyticsDashboard` 展示活跃度与满意度统计。
- **反馈**：`feedback/` 目录包含满意度投票组件，配合 `FeedbackController` API。

## 开发提示
- **代理**：开发环境统一通过 `/api` 代理到 `localhost:8080`，避免 CORS；生产环境使用 `VITE_API_BASE_URL`。
- **WebSocket**：协作与通知分别读取 `VITE_WS_URL`、`VITE_NOTIFICATION_WS_URL`，未配置时按默认推导。
- **状态管理**：轻量化策略，除认证使用 Context 外，其余模块以局部 state + hooks 为主，便于并行开发。
- **样式**：Tailwind CSS + `clsx` + `tailwind-merge`，在 `src/components/ui` 中放置通用 UI。

## 手动验证建议
1. 启动全套服务（参考根 README 或 `docs/GUIDE-01`）。
2. 创建两个浏览器窗口登陆不同账号，验证协同编辑与通知推送。
3. 在 `VersionManagementPage` 手动创建版本、查看 Diff、执行恢复。
4. 登录管理员账号，检查用户列表筛选、CSV 导出、活跃度/满意度组件。
5. 通过导入导出入口测试 doc-converter-service（最大 50MB）。

如需更多前后端联调细节，请结合 `docs/ARCH-01`、`docs/API-01` 与 `docs/PROJECT-项目总结`。***
