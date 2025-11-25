# codox 项目功能清单

> 最后更新：2025-11-23

## 📋 功能总览

## 🧱 项目结构梳理

```目录
codox/
├── cpp-service/            # Drogon + PostgreSQL 主业务 API
├── collab-service/         # y-websocket 协作/通知网关
├── doc-converter-service/  # 文档导入导出转换器
├── frontend/               # React + Tiptap Web 前端
├── docs/                   # 需求/设计/项目文档
├── scripts/                # 辅助脚本（启动、同步、数据）
├── docker-compose.yml      # Meilisearch / MinIO 等支撑服务编排
└── meili_data/             # Meilisearch 数据卷（开发态）
```

### 核心服务职责
- `cpp-service`：提供认证、文档/版本/ACL、评论、任务、通知、搜索等 REST API，负责与 PostgreSQL、MinIO、Meilisearch、doc-converter 对接。
- `collab-service`：基于 Yjs 的 WebSocket 服务，校验 `cpp-service` 下发的协作令牌，维护实时协作文档与通知推送通道。
- `doc-converter-service`：Node.js/LibreOffice 套件完成 Word/PDF/Markdown 互转，供 `cpp-service` 与前端导入导出流程调用。
- `frontend`：Vite + React + Tiptap 前端，整合鉴权、编辑器、评论/任务侧边栏、通知中心、导入导出等界面。

### 服务之间的调用链路
1. 用户首先通过 `frontend` 调用 `cpp-service` 进行登录，获取 JWT。
2. 文档编辑时，前端向 `cpp-service` 申请协作令牌，再使用该令牌连接 `collab-service` 进入实时协作房间。
3. 文档导入导出由 `frontend` 调用 `cpp-service` 的导入/导出 API，后者再转发至 `doc-converter-service` 完成格式转换并写入 MinIO。
4. `cpp-service` 将文档元数据索引至 Meilisearch，并负责通知/任务事件持久化；`collab-service` 通过 WebSocket 将新通知推送到在线客户端。

### 运行端口与依赖
- `cpp-service`：HTTP `:8080`，依赖 PostgreSQL、MinIO、Meilisearch、doc-converter。
- `collab-service`：WebSocket `:1234`，依赖 Redis（若开启持久化）与 `cpp-service` 颁发的协作令牌。
- `doc-converter-service`：HTTP `:3002`，依赖本地 LibreOffice / pdf-lib 等二进制。
- `frontend`：Vite Dev Server `:5173`，通过 `.env.local` 配置 `VITE_API_BASE_URL` 与 `VITE_WS_URL`。

> 通过 `docker compose up -d meilisearch minio` 可快速拉起全文检索与对象存储；其余服务按各自 README 启动。

### ✅ 已完成功能

#### 1. 用户认证与安全
- [x] 用户注册（邮箱、密码、可选昵称）
- [x] 用户登录（支持邮箱/手机号）
- [x] JWT Token 认证（access_token + refresh_token）
- [x] Token 自动刷新机制
- [x] 密码加密（SHA-256 + Salt）
- [x] 用户资料管理（昵称、头像、简介）

#### 2. 用户搜索
- [x] 用户搜索 API（按ID、邮箱、昵称）
- [x] 分页支持
- [x] 智能匹配（数字优先匹配ID）
- [x] ACL 管理界面集成

#### 3. 文档管理
- [x] 文档创建
- [x] 文档列表（分页、筛选、排序）
- [x] 文档详情查看
- [x] 文档更新（标题、锁定状态、标签）
- [x] 文档删除（软删除）
- [x] 标签管理

#### 4. 权限管理（ACL）
- [x] ACL 列表查看（仅文档所有者）
- [x] ACL 更新（添加/修改/移除协作者）
- [x] 权限级别：owner、editor、viewer
- [x] 防止修改 owner 权限
- [x] 用户搜索集成（添加协作者时）
- [x] 权限验证中间件

#### 5. 文档版本控制
- [x] 版本发布
- [x] 版本列表查看
- [x] 版本回滚
- [x] 版本详情查看
- [x] 版本差异对比
- [x] 手动创建版本
- [x] 版本恢复

#### 6. 实时协作
- [x] 协作令牌生成
- [x] Yjs + y-websocket 集成
- [x] 快照管理（MinIO 存储）
- [x] 引导快照获取
- [x] 快照回调处理
- [x] Tiptap 编辑器集成

#### 7. 评论系统
- [x] 评论创建（支持回复）
- [x] 评论列表（树形结构）
- [x] 评论删除
- [x] 锚点定位
- [x] 前端评论侧边栏

#### 8. 任务管理
- [x] 任务创建
- [x] 任务列表查看
- [x] 任务更新（状态、标题、负责人、截止日期）
- [x] 任务删除
- [x] 任务状态：todo、doing、done
- [x] 前端任务看板

#### 9. 通知系统
- [x] 通知列表查询（分页）
- [x] 通知已读标记
- [x] 未读通知计数
- [x] 通知类型：评论、任务、文档等
- [x] 通知筛选功能（类型、文档ID、日期范围、未读状态）
- [x] 前端通知中心

#### 10. 全文搜索
- [x] Meilisearch 集成
- [x] 文档索引同步
- [x] 关键词搜索
- [x] 权限过滤
- [x] 搜索结果高亮
- [x] 前端搜索页面

#### 11. 文档导入导出
- [x] Markdown 文档导入（转 HTML）
- [x] Word 文档导出（HTML 转 .docx）
- [x] PDF 文档导出（文本转 PDF）
- [x] Markdown 文档导出（HTML 转 Markdown）
- [x] 独立转换服务（doc-converter-service）
- [x] 前端导入导出 UI 组件
- [x] 文件大小限制（50MB）
- [x] 权限验证（导出需要 viewer 权限）

#### 12. 文档状态管理
- [x] 文档状态字段（draft、saved、published、archived、locked）
- [x] 状态手动更新
- [x] 保存后自动更新状态（draft → saved）
- [x] 状态筛选功能
- [x] 前端状态显示和切换

#### 13. 主页统计优化
- [x] 协作文档统计（基于 ACL）
- [x] 需要关注文档统计（基于未完成任务）
- [x] 协作文档列表展示
- [x] 需要关注文档列表展示
- [x] 统计卡片交互优化

#### 14.其他功能优化
- [x] 通知系统筛选功能（类型、文档ID、日期范围、未读状态）
- [x] WebSocket 实时通知推送
- [x] 版本时间线可视化
- [x] 版本差异高亮显示
- [x] 管理员用户管理
- [x] 用户行为分析
- [x] 满意度调查

## 🛠️ 技术栈

### 后端
- **框架**：Drogon 1.9.11（C++ HTTP 框架）
- **数据库**：PostgreSQL
- **认证**：JWT（jwt-cpp）
- **存储**：MinIO（对象存储）
- **搜索**：Meilisearch

### 协作服务
- **框架**：Node.js + TypeScript
- **协议**：Yjs + y-websocket
- **端口**：1234

### 前端
- **框架**：React 18
- **构建工具**：Vite
- **编辑器**：Tiptap
- **样式**：Tailwind CSS
- **状态管理**：React Context

## 📊 数据统计

### API 端点数量
- 认证相关：3 个
- 用户相关：3 个
- 文档相关：16+ 个（包含导入导出 6 个）
- 协作相关：5 个
- 评论相关：3 个
- 任务相关：4 个
- 通知相关：3 个
- 搜索相关：1 个

### 数据库表
- 用户表：`user`、`user_profile`
- 文档表：`document`、`document_version`、`doc_acl`
- 协作表：`collaboration_token`
- 评论表：`comment`
- 任务表：`task`
- 通知表：`notification`

### 服务组件
- **cpp-service**：C++ 后端 API 服务（端口 8080）
- **collab-service**：Yjs WebSocket 协作服务（端口 1234）
- **doc-converter-service**：文档转换服务（端口 3002）
- **frontend**：React 前端应用（端口 5173）

## 🔒 安全特性

- [x] JWT Token 认证
- [x] 密码加密（SHA-256 + Salt）
- [x] SQL 注入防护（参数化查询）
- [x] 权限验证中间件
- [x] 输入验证
- [x] CORS 配置（开发环境使用代理）

## 📚 相关文档

- [API 设计文档](./API-01-API设计.md)
- [总体设计文档](./ARCH-01-总体设计.md)
- [详细设计文档](./ARCH-02-详细设计.md)
- [项目启动指南](./GUIDE-01-项目启动指南.md)
- [项目总结](./PROJECT-项目总结.md)

