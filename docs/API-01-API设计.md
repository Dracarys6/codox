---
title: codox API 总览
description: 记录 codox 当前已实现的后端接口与规划中的未来接口，为研发与测试提供统一参考。
---

# codox API 总览

> 文档版本：2025-01-20  codox
> 维护人：研发团队（已同步第四阶段最新功能：文档导入导出、状态管理、主页统计、通知筛选）

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
- `GET /api/users/search` — 搜索用户，支持按用户ID、邮箱、昵称搜索；支持分页（`q`、`page`、`page_size` 参数），返回用户列表及总数。

> ✅ 用户搜索模块已完成实现，支持多字段搜索和分页功能，主要用于 ACL 权限管理中添加协作者。

### 文档 CRUD
- `POST /api/docs` — 新建文档，标题必填；自动创建 owner ACL，可附带初始标签；默认状态为 `draft`。
- `GET /api/docs` — 文档列表，支持 `page`、`pageSize`、`tag`、`author`、`status` 筛选，仅返回有权限的文档。
- `GET /api/docs/{id}` — 文档详情，返回标签、锁定状态、文档状态、最后发布版本等。
- `PATCH /api/docs/{id}` — 修改标题/锁定状态/文档状态/标签（标签增删差异化更新）。
- `DELETE /api/docs/{id}` — 删除文档（实现为软删除入口），需 owner 权限。
- `GET /api/docs/{id}/acl` — 仅文档 owner 可调用，返回完整 ACL 列表（包含用户信息、权限、邮箱、昵称等）。
- `PUT /api/docs/{id}/acl` — 仅 owner 可调用，替换除 owner 外的 ACL 记录（需校验权限枚举：viewer、editor），防止删除或修改 owner 权限。

### 实时协作
- `POST /api/collab/token` — 生成协作一次性令牌（默认 1 小时有效），需 `doc_id`。
- `GET /api/collab/bootstrap/{id}` — 返回最新快照元数据（`snapshot_url`、`sha256`、`version_id`），供编辑器初始化。
- `POST /api/collab/snapshot/{id}` — 协作服务回调 Webhook，落地快照并记录版本，需 `X-Webhook-Token` 校验。

### 评论
- `GET /api/docs/{id}/comments` — 获取指定文档的评论列表，返回树形结构的评论数据，包含作者信息。
- `POST /api/docs/{id}/comments` — 创建评论，支持顶级评论和回复（通过 `parent_id` 指定），请求体需包含 `content`、`anchor`（可选）、`parent_id`（可选）。
- `DELETE /api/comments/{id}` — 删除评论，仅评论作者或具备管理权限的用户可删除。

> ✅ 评论模块已完成实现，支持评论创建、查询和删除功能。

### 任务管理
- `GET /api/docs/{id}/tasks` — 获取文档关联的任务列表，返回任务详情、状态、指派人等信息。
- `POST /api/docs/{id}/tasks` — 创建任务，请求体需包含 `title`、`assignee_id`（可选）、`description`（可选）、`due_date`（可选）等字段，需要 editor 或更高权限。
- `PATCH /api/tasks/{id}` — 更新任务状态或详情，支持更新 `status`（todo/doing/done）、`title`、`description`、`assignee_id`、`due_date` 等字段。
- `DELETE /api/tasks/{id}` — 删除任务，仅任务创建者或文档所有者可删除。

> ✅ 任务管理模块已完成实现，支持任务的创建、查询、更新和删除功能。

### 通知中心
- `GET /api/notifications` — 分页查询通知列表，支持 `page`、`page_size`、`unread_only`、`type`、`doc_id`、`start_date`、`end_date` 参数过滤，返回通知详情、类型、创建时间等。
- `POST /api/notifications/read` — 批量标记指定通知为已读，请求体需包含 `notification_ids` 数组。
- `GET /api/notifications/unread-count` — 获取当前用户的未读通知总数。

> ✅ 通知中心模块已完成实现，支持通知查询、已读标记、未读计数和完整的筛选功能（类型、文档ID、日期范围、未读状态）。
>
> 🔧 计划扩展：通知偏好设置接口、WebSocket 实时推送。

### 全文搜索
- `GET /api/search` — 根据关键词搜索文档，支持 `q`（查询关键词）、`page`、`page_size` 参数，返回结果按权限过滤，仅包含用户有权限访问的文档。

> ✅ 全文搜索模块已完成实现，集成 Meilisearch 搜索引擎，支持关键词搜索和权限过滤。

### 实时通讯（第四阶段）
- `POST /api/chat/rooms` — 创建聊天室，支持 `direct`（直接聊天）、`group`（群组）、`document`（文档关联）三种类型；请求体需包含 `name`、`type`、`member_ids`，文档类型需额外提供 `doc_id`。
- `GET /api/chat/rooms` — 获取当前用户的聊天室列表，支持分页（`page`、`page_size`），返回每个聊天室的最后消息、未读数量等信息。
- `POST /api/chat/rooms/{id}/members` — 向聊天室添加成员，请求体需包含 `user_ids` 数组。
- `GET /api/chat/rooms/{id}/messages` — 获取聊天室消息历史，支持分页（`page`、`page_size`）和游标分页（`before_id`），返回消息内容、发送者信息、已读状态等。
- `POST /api/chat/rooms/{id}/messages` — 发送消息，请求体需包含 `content` 或 `file_url` 至少一个，可选 `message_type`（默认 `text`）、`reply_to`（回复消息ID）。
- `POST /api/chat/messages/{id}/read` — 标记指定消息为已读，自动更新聊天室成员的 `last_read_at`。
- `POST /api/chat/rooms/{id}/files` — 上传聊天附件（multipart/form-data，单文件≤20MB，支持 `jpg/jpeg/png/gif/webp/bmp/svg/pdf/doc/docx/ppt/pptx/xls/xlsx/txt/md/zip`），自动写入 `chat_message` 并返回可消费的消息体。
- `GET /api/chat/messages/{id}/file` — 下载指定消息的附件（需聊天成员身份，返回 Blob/流，前端将结果转换为预览或下载链接）。

> ✅ 实时通讯模块已完成实现，支持三种聊天室类型、消息发送/接收、已读状态管理等功能。

---

### 文档版本
- `POST /api/docs/{id}/publish` — owner/editor 发布新版本，写入 `document_version` 并更新 `last_published_version_id`。
- `GET /api/docs/{id}/versions` — 列出历史版本记录。
- `POST /api/docs/{id}/rollback/{versionId}` — 将文档回滚到指定版本（需记录操作者及生成新版本或标记回滚）。

---

## 已上线接口（第四阶段）

### 文档导入导出 ✅
- `POST /api/docs/import/word` — 上传 Word 文件（.docx），转换为内部格式，返回文档 ID。
- `POST /api/docs/import/pdf` — 上传 PDF 文件，提取文本内容，返回文档 ID。
- `POST /api/docs/import/markdown` — 上传 Markdown 文件或直接提交 Markdown 文本，转换为 HTML，返回文档 ID。
- `GET /api/docs/{id}/export/word` — 基于文档内容导出为 Word 格式（.docx）。
- `GET /api/docs/{id}/export/pdf` — 基于文档内容导出为 PDF 格式。
- `GET /api/docs/{id}/export/markdown` — 基于文档内容导出为 Markdown 格式。

> ✅ 文档导入导出模块已完成实现，支持 Word/PDF/Markdown 三种格式的导入导出，使用独立的 doc-converter-service 进行格式转换。

### 文档状态管理 ✅
- `PATCH /api/docs/{id}` — 支持更新文档状态（`status` 字段），可选值：`draft`（草稿）、`saved`（已保存）、`published`（已发布）、`archived`（已归档）、`locked`（已锁定）。
- 文档保存后自动将状态从 `draft` 更新为 `saved`。

> ✅ 文档状态管理已完成实现，支持手动设置状态和自动状态更新。

## 即将上线接口（第四阶段增强）

### 通知偏好设置
- WebSocket 通道：在 `collab-service` 中扩展 `/notifications`，推送实时通知。
- `GET /api/notifications/settings` — 获取通知偏好设置。
- `PUT /api/notifications/settings` — 更新通知偏好设置。

### 文档版本增强
- `GET /api/docs/{id}/versions/{versionId}` — 查看单个版本详情、快照元数据。
- `POST /api/docs/{id}/versions` — 手动保存版本（附带 `change_summary`）。
- `POST /api/docs/{id}/versions/{versionId}/restore` — 一键恢复，自动写入新的版本记录（含“来源版本”字段）。

### 用户管理 / 运营
- `GET /api/admin/users` — 分页、角色、状态、关键字筛选；需要 `admin` 权限。
- `PATCH /api/admin/users/{id}` — 修改账号状态（启用/停用）、锁定、备注。
- `POST /api/admin/users/{id}/roles` — 调整角色集合；操作写入审计日志。
- `GET /api/admin/user-analytics` — 根据时间段输出活跃度、文档/评论/任务等指标。
- `POST /api/feedback` & `GET /api/feedback/stat` — 收集满意度问卷并生成汇总报表。

> 以上接口的详细行为、错误码、字段定义，详见《PHASE-04-功能完善开发指南.md》与《ARCH-02-详细设计.md》中的最新章节。

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
  所有成员与权限枚举展示、批量编辑对话框、防止 owner 权限被移除；支持搜索数据库中的用户并添加到权限列表。
- **版本管理面板**  
  版本列表（版本号、作者、发布时间、备注）、发布按钮、回滚操作确认。

### 第三阶段已实现模块
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

### 第四阶段已实现模块
- **实时通讯组件**  
  聊天室列表、消息列表、消息发送、已读状态、文件/图片消息支持、消息回复功能。

### 第四阶段规划模块
- **通知中心增强**  
  类型/文档筛选、日期范围选择器、通知偏好面板、实时推送提示。
- **导入导出向导**  
  Word/PDF/Markdown 上传、进度反馈、冲突提示、导出按钮组。
- **版本时间线 / Diff 视图**  
  版本快照列表、差异高亮、只读预览、恢复确认弹窗。
- **管理员控制台**  
  用户列表视图、批量启停、角色调整、活跃度图表、满意度反馈收集。

> 建议在每个阶段交付后同步更新本节，确保前后端模块与 API 设计一一对应。

---

## 参考资料
- `docs/详细设计.md` — 完整 API 交互设计、请求/响应示例、错误码约定。
- `docs/第二阶段开发指南.md` — 文档 ACL、版本发布等迭代目标与实现建议。
- `docs/第三阶段开发指南.md` — 实时协作、评论、任务、通知、搜索等高级功能规划。
- `docs/PHASE-04-功能完善开发指南.md` — 第四阶段功能完善，包括实时通讯、通知增强、导入导出等。
- `cpp-service/src/controllers/*` — 当前服务端接口实现，建议与本文件保持联动更新。

如需扩展或导出其他格式，可在此基础上继续维护。欢迎在每次迭代后同步更新此文档，以保持研发、测试、产品对齐。

