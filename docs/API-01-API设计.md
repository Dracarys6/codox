---
title: codox API 总览
description: 记录 codox 当前已实现的后端接口与规划中的未来接口，为研发与测试提供统一参考。
---

# codox API 总览

> 文档版本：2025-11-23（发布版）
> 维护人：研发团队

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

### 实时通讯（已取消）

> 原规划的 `/api/chat/*` HTTP API 与 WebSocket 能力已整体下线。

---

### 文档版本
- `POST /api/docs/{id}/publish` — owner/editor 发布新版本，写入 `document_version` 并更新 `last_published_version_id`。
- `GET /api/docs/{id}/versions` — 列出历史版本记录。
- `POST /api/docs/{id}/rollback/{versionId}` — 将文档回滚到指定版本（需记录操作者及生成新版本或标记回滚）。

### 文档版本增强
- `GET /api/docs/{id}/versions/{versionId}` — 获取单个版本详情（HTML、纯文本、快照、创建者信息、变更摘要）。
- `POST /api/docs/{id}/versions` — 手动保存版本，可附带 `change_summary` 与来源信息。
- `POST /api/docs/{id}/versions/{versionId}/restore` — 一键恢复并自动写入新的版本记录。
- `GET /api/docs/{id}/versions/{versionId}/diff` — 输出指定版本与当前内容的差异（块级 diff + 高亮）。

---

### 文档导入导出
- `POST /api/docs/import/markdown` — 上传 Markdown 文件或直接提交 Markdown 文本，转换为 HTML，返回文档 ID。
- `GET /api/docs/{id}/export/word` — 基于文档内容导出为 Word 格式（.docx）。
- `GET /api/docs/{id}/export/pdf` — 基于文档内容导出为 PDF 格式。
- `GET /api/docs/{id}/export/markdown` — 基于文档内容导出为 Markdown 格式。

> ✅ 文档导入导出模块已完成实现，支持 Word/PDF/Markdown 三种格式的导入导出，使用独立的 doc-converter-service 进行格式转换。

---

### 文档状态管理
- `PATCH /api/docs/{id}` — 支持更新文档状态（`status` 字段），可选值：`draft`（草稿）、`saved`（已保存）、`published`（已发布）、`archived`（已归档）、`locked`（已锁定）。
- 文档保存后自动将状态从 `draft` 更新为 `saved`。

> ✅ 文档状态管理已完成实现，支持手动设置状态和自动状态更新。

---

### 管理员与运营
- `GET /api/admin/users` — 多条件（关键字、角色、状态、创建时间）分页查询，支持 `export=csv` 导出。
- `PATCH /api/admin/users/{id}` — 启停账号、锁定/解锁、备注更新并写入审计日志。
- `POST /api/admin/users/{id}/roles` — 调整角色集合，自动记录审计。
- `GET /api/admin/user-analytics` — 按日期范围输出活跃度、文档/评论/任务等指标。

> 所有管理员接口由 `AdminUserController` 提供，需 `admin` 角色授权。

### 满意度反馈
- `POST /api/feedback` — 登录用户提交满意度与文本意见。
- `GET /api/feedback/stat` — 管理员查看满意度占比、常见反馈摘要。

---

## 参考资料
- `docs/ARCH-02-详细设计.md` — 完整 API 交互设计、请求/响应示例、错误码约定。
- `docs/PROJECT-项目总结.md` — 发布说明与功能概览。
- `cpp-service/src/controllers/*` — 当前服务端接口实现，建议与本文件保持联动更新。

如需扩展或导出其他格式，可在此基础上继续维护。欢迎在每次迭代后同步更新此文档，以保持研发、测试、产品对齐。

