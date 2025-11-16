---
title: DocSync API 总览
description: 记录 DocSync 当前已实现的后端接口与规划中的未来接口，为研发与测试提供统一参考。
---

# DocSync API 总览

> 文档版本：2025-11-13  
> 维护人：研发团队（最后更新自 GPT-5 Codex 导出的整理）

本文件汇总 DocSync 多人在线文档协作平台的 API 设计，分为「当前可用接口」与「规划中的接口」。其中「当前」部分基于 `cpp-service` 代码实现；「规划」部分来源于《第二阶段开发指南》《第三阶段开发指南》《详细设计》等文档。

---

## 当前可用接口（已在仓库实现）

### 系统健康
- `GET /health` — 服务心跳检测。

### 认证
- `POST /api/auth/register` — 注册邮箱账号，可选昵称。
- `POST /api/auth/login` — 登录，支持邮箱/手机号；返回 `access_token`、`refresh_token` 以及用户概要资料。
- `POST /api/auth/refresh` — 使用刷新令牌换取新的访问令牌。

### 用户资料
- `GET /api/users/me` — 获取当前用户信息，包含 `profile` 扩展字段。
- `PATCH /api/users/me` — 更新昵称、头像、简介，自动 upsert `user_profile`。

### 文档 CRUD
- `POST /api/docs` — 新建文档，标题必填；自动创建 owner ACL，可附带初始标签。
- `GET /api/docs` — 文档列表，支持 `page`、`pageSize`、`tag`、`author` 筛选，仅返回有权限的文档。
- `GET /api/docs/{id}` — 文档详情，返回标签、锁定状态、最后发布版本等。
- `PATCH /api/docs/{id}` — 修改标题/锁定状态/标签（标签增删差异化更新）。
- `DELETE /api/docs/{id}` — 删除文档（实现为软删除入口），需 owner 权限。

### 实时协作
- `POST /api/collab/token` — 生成协作一次性令牌（默认 1 小时有效），需 `doc_id`。
- `GET /api/collab/bootstrap/{id}` — 返回最新快照元数据（`snapshot_url`、`sha256`、`version_id`），供编辑器初始化。
- `POST /api/collab/snapshot/{id}` — 协作服务回调 Webhook，落地快照并记录版本，需 `X-Webhook-Token` 校验。

### 评论
- `GET /api/docs/{id}/comments` — 已在控制器中实现，返回指定文档的评论列表。
- `POST /api/docs/{id}/comments` — 控制器骨架已存在，后续需补全内容校验、入库逻辑。
- `DELETE /api/comments/{id}` — 删除评论，需要评论id `comment_id`

> ⚠️ 注意：评论模块的新增/删除实现仍有 TODO，使用前请补全控制器内逻辑。

---

## 规划中的接口（设计稿/阶段指南）

以下接口尚未在代码中完成实现，需结合阶段计划逐步落地。

### 文档权限（ACL）
- `GET /api/docs/{id}/acl` — 仅文档 owner 可调用，返回完整 ACL 列表。
- `PUT /api/docs/{id}/acl` — 仅 owner 可调用，替换除 owner 外的 ACL 记录（需校验权限枚举）。

### 文档版本
- `POST /api/docs/{id}/publish` — owner/editor 发布新版本，写入 `document_version` 并更新 `last_published_version_id`。
- `GET /api/docs/{id}/versions` — 列出历史版本记录。
- `POST /api/docs/{id}/rollback/{versionId}` — 将文档回滚到指定版本（需记录操作者及生成新版本或标记回滚）。

### 评论（完善阶段）
- `POST /api/docs/{id}/comments` — 需完成请求体验证（`content`、`anchor`、`parent_id`），并区分回复/顶级评论。
- `DELETE /api/comments/{id}` — 校验作者或具备管理权限的用户可删除。

### 任务管理
- `GET /api/docs/{id}/tasks` — 获取文档关联任务列表。
- `POST /api/docs/{id}/tasks` — 创建任务（标题、指派人、截止时间等字段）。
- `PATCH /api/tasks/{id}` — 更新任务状态或详情。
- `DELETE /api/tasks/{id}` — 删除任务。

### 通知中心
- `GET /api/notifications` — 分页查询通知，可通过 `page`、`page_size`、`unread_only` 过滤。
- `POST /api/notifications/read` — 批量标记指定通知为已读。
- `GET /api/notifications/unread-count` — 获取未读通知总数。

### 全文搜索
- `GET /api/search` — 根据关键词、作者、标签、时间区间等参数检索文档（需调用搜索服务并按 ACL 过滤结果）。

---

## 前端页面模块需求

> 根据 `frontend/FIRST_PHASE_COMPLETE.md`、第二/第三阶段开发指南以及现有页面实现整理。

### 当前已实现页面
- **登录页** `LoginPage.tsx`  
  表单验证（邮箱/手机号、密码）、错误提示、跳转逻辑。
- **注册页** `RegisterPage.tsx`  
  邮箱格式校验、密码强度、可选昵称、成功后跳转登录。
- **个人资料页** `ProfilePage.tsx`  
  展示邮箱/角色（只读）、编辑昵称/简介/头像 URL、保存状态提示、退出登录。
- **首页** `HomePage.tsx`  
  欢迎文案、功能导航、状态检查提醒。
- **全局组件**  
  - `Navbar`：自适应导航栏、登录状态、入口按钮。  
  - `Layout`：标准页骨架，包含导航与内容区域。  
  - `ProtectedRoute`：路由守卫，结合 `AuthContext` 管理会话。

### 第二阶段规划模块
- **文档列表页** `DocumentListPage.tsx`  
  分页、标签/作者筛选、排序、快捷操作区（新建、收藏、最近访问）。
- **文档详情页** `DocumentDetailPage.tsx`  
  文档元信息、标签管理、协作者列表、活动时间线、快捷操作按钮。
- **文档编辑页** `DocumentEditorPage.tsx`  
  富文本编辑器、实时协作状态指示、自动保存反馈、返回入口。
- **ACL 管理面板** `AclManager.tsx`  
  所有成员与权限枚举展示、批量编辑对话框、防止 owner 权限被移除。
- **版本管理面板**  
  版本列表（版本号、作者、发布时间、备注）、发布按钮、回滚操作确认。

### 第三阶段规划模块
- **评论侧边栏**  
  支持锚点高亮、嵌套回复、筛选（全部/待处理/我参与）、编辑/删除权限控制。
- **任务面板**  
  看板或列表视图、状态切换（todo/doing/done）、负责人选择、截止日期提醒。
- **通知中心**  
  通知列表、已读状态切换、批量操作、未读计数徽标（全局导航中展示）。
- **搜索页面** `SearchPage.tsx`  
  高级搜索条件（关键词、作者、标签、时间段）、结果高亮、按权限过滤提示。
- **协作状态组件**  
  在线成员头像、光标位置标记、同步延迟/异常提示。

> 建议在每个阶段交付后同步更新本节，确保前后端模块与 API 设计一一对应。

---

## 参考资料
- `docs/详细设计.md` — 完整 API 交互设计、请求/响应示例、错误码约定。
- `docs/第二阶段开发指南.md` — 文档 ACL、版本发布等迭代目标与实现建议。
- `docs/第三阶段开发指南.md` — 实时协作、评论、任务、通知、搜索等高级功能规划。
- `cpp-service/src/controllers/*` — 当前服务端接口实现，建议与本文件保持联动更新。

如需扩展或导出其他格式，可在此基础上继续维护。欢迎在每次迭代后同步更新此文档，以保持研发、测试、产品对齐。

