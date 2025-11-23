# codox 项目总结

> 最后更新：2025-11-23

## 📊 项目概览

**codox** 是一个多人在线协作文档系统，采用 C++/Drogon 后端、Node.js 协作服务与 React 前端的技术栈，提供实时协作编辑、权限管理、版本控制、评论任务、通知系统、全文搜索、实时通讯和文档导入导出等功能。

## 🎯 核心功能完成情况

### ✅ 已完成功能（12 大模块）

1. **用户认证与安全** ✅
   - 注册/登录、JWT Token、密码加密、用户资料管理

2. **用户搜索** ✅
   - 按ID、邮箱、昵称搜索，用于 ACL 权限管理

3. **文档管理** ✅
   - CRUD、标签、列表筛选排序

4. **权限管理（ACL）** ✅
   - 文档级权限控制、owner/editor/viewer 三级权限

5. **文档版本控制** ✅
   - 版本发布、回滚、差异对比、手动创建版本

6. **实时协作** ✅
   - Yjs + y-websocket、快照管理、Tiptap 编辑器集成

7. **评论系统** ✅
   - 评论创建、树形结构、锚点定位、前端侧边栏

8. **任务管理** ✅
   - 任务 CRUD、状态管理、前端看板

9. **通知系统** ✅
   - 通知列表、已读标记、未读计数、通知中心

10. **全文搜索** ✅
    - Meilisearch 集成、权限过滤、搜索结果高亮

11. **文档导入导出** ✅（最新完成）
    - Word/PDF/Markdown 导入导出
    - 独立转换服务（doc-converter-service）
    - 完整的前后端实现

12. **文档状态管理** ✅（最新完成）
    - 文档状态字段（draft、saved、published、archived、locked）
    - 保存后自动更新状态
    - 状态筛选和手动切换

13. **主页统计优化** ✅（最新完成）
    - 协作文档统计和列表展示
    - 需要关注文档统计和列表展示
    - 统计卡片交互优化

14. **通知筛选功能** ✅（最新完成）
    - 支持按类型、文档ID、日期范围、未读状态筛选
    - 前端筛选界面优化

### 🔄 开发中功能

15. **实时通讯** ✅
    - 聊天室、消息 CRUD、WebSocket 推送、文件共享
- 版本时间线可视化
- 版本差异高亮显示
- 管理员用户管理
- 用户行为分析
- 满意度调查

## 🏗️ 技术架构

### 服务组件

| 服务 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| cpp-service | C++ (Drogon) | 8080 | 主业务 API 服务 |
| collab-service | Node.js + TypeScript | 1234 | Yjs WebSocket 协作服务 |
| doc-converter-service | Node.js + Express | 3002 | 文档转换服务 |
| frontend | React + Vite | 5173 | 前端应用 |

### 基础设施

- **PostgreSQL**: 主数据库（端口 5432）
- **Meilisearch**: 全文搜索（端口 7700）
- **MinIO**: 对象存储（端口 9000/9001）

## 📁 项目结构

```
codox/
├── cpp-service/              # C++ 后端服务
│   ├── src/
│   │   ├── controllers/      # API 控制器
│   │   │   ├── DocumentController.*  # 文档管理（含导入导出）
│   │   │   ├── ChatController.*      # 实时通讯
│   │   │   └── ...
│   │   ├── utils/            # 工具类
│   │   └── main.cpp
│   └── config.json
├── collab-service/           # 协作服务
│   └── server.ts
├── doc-converter-service/    # 文档转换服务
│   ├── index.js
│   └── package.json
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── ImportModal.tsx      # 导入组件
│   │   │   ├── ExportMenu.tsx       # 导出组件
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── HomePage.tsx         # 主页（含导入导出）
│   │   │   ├── DocumentsPage.tsx    # 文档列表（含导入导出）
│   │   │   └── EditorPage.tsx       # 编辑器（含导出）
│   │   └── api/client.ts            # API 客户端
│   └── package.json
├── docs/                     # 项目文档
│   ├── PHASE-04-功能完善开发指南.md
│   ├── GUIDE-03-文档导入导出功能说明.md
│   └── ...
└── README.md
```

## 📈 统计数据

### API 端点
- 认证相关：3 个
- 用户相关：3 个
- 文档相关：19+ 个（包含导入导出 6 个、状态管理）
- 协作相关：5 个
- 评论相关：3 个
- 任务相关：4 个
- 通知相关：3 个（支持完整筛选功能）
- 搜索相关：1 个
- 聊天相关：7 个

### 数据库表
- 用户表：`user`、`user_profile`
- 文档表：`document`、`document_version`、`doc_acl`、`doc_tag`、`tag`
- 协作表：`collaboration_token`
- 评论表：`comment`
- 任务表：`task`
- 通知表：`notification`
- 聊天表：`chat_room`、`chat_message`、`chat_room_member`、`chat_message_read`

## 🚀 快速启动

### 1. 启动基础设施
```bash
docker-compose up -d  # PostgreSQL, Meilisearch, MinIO
```

### 2. 启动应用服务
```bash
# C++ 后端
cd cpp-service && ./build/cpp-service

# 协作服务
cd collab-service && npm start

# 文档转换服务
cd doc-converter-service && npm start

# 前端
cd frontend && npm run dev
```

## 📚 文档索引

### 核心文档
- [总体设计文档](./ARCH-01-总体设计.md)
- [详细设计文档](./ARCH-02-详细设计.md)
- [功能清单](./PROJECT-功能清单.md)

### 开发指南
- [第一阶段：用户认证](./PHASE-01-用户认证开发指南.md) ✅
- [第二阶段：文档管理](./PHASE-02-文档管理开发指南.md) ✅
- [第三阶段：协作功能](./PHASE-03-协作功能开发指南.md) ✅
- [第四阶段：功能完善](./PHASE-04-功能完善开发指南.md) 🔄

### 操作指南
- [项目启动指南](./GUIDE-01-项目启动指南.md)
- [文档导入导出功能说明](./GUIDE-03-文档导入导出功能说明.md) ✅

## 🎉 最新更新（2025-11-23）

### 文档状态管理 ✅

**完成内容：**
- ✅ 文档状态字段（draft、saved、published、archived、locked）
- ✅ 保存后自动更新状态（draft → saved）
- ✅ 状态筛选功能
- ✅ 前端状态显示和切换

### 主页统计优化 ✅

**完成内容：**
- ✅ 协作文档统计（基于 ACL，显示有多个用户的文档）
- ✅ 需要关注文档统计（基于未完成任务）
- ✅ 协作文档列表展示
- ✅ 需要关注文档列表展示
- ✅ 统计卡片交互优化（点击跳转到对应列表）

### 通知筛选功能 ✅

**完成内容：**
- ✅ 支持按类型筛选（评论、任务分配、任务状态变更、权限变更）
- ✅ 支持按文档ID筛选
- ✅ 支持按日期范围筛选（开始日期、结束日期）
- ✅ 支持未读状态筛选
- ✅ 前端筛选界面优化
- ✅ 日期格式自动转换（ISO 8601）

### 文档导入导出功能 ✅（2025-11-23）

**完成内容：**
- ✅ 创建 doc-converter-service（Node.js 转换服务）
- ✅ 实现 Word/PDF/Markdown 导入导出接口
- ✅ 前端 ImportModal 和 ExportMenu 组件
- ✅ 集成到主页、文档列表、编辑页面
- ✅ 完整的错误处理和用户提示

**技术实现：**
- 后端：DocumentController 中添加 6 个导入导出接口
- 转换服务：独立 Node.js 服务，使用 mammoth、pdf-parse、pdf-lib、marked 等库
- 前端：React 组件，支持文件上传、文本输入、自动下载

**使用位置：**
- 主页：欢迎区域和快速操作卡片
- 文档列表：每个文档的操作列
- 编辑页面：顶部工具栏

## 🔜 下一步计划

1. **通知系统增强**
   - 通知过滤参数完善
   - 用户偏好设置
   - WebSocket 实时推送优化

2. **版本管理增强**
   - 版本时间线可视化
   - 版本差异高亮显示
   - 一键回滚功能

3. **用户管理**
   - 管理员用户列表
   - 用户权限调整
   - 用户行为分析

4. **测试与优化**
   - 端到端测试
   - 性能优化
   - 错误处理完善

## 📝 开发规范

- **代码风格**：遵循项目现有代码风格，添加简要注释
- **错误处理**：完善的错误处理和用户提示
- **权限验证**：所有接口都有权限检查
- **异步操作**：使用异步数据库操作提高性能
- **响应格式**：统一的 JSON 响应格式

## 🤝 贡献指南

1. 遵循现有代码风格
2. 添加必要的注释
3. 完善错误处理
4. 更新相关文档
5. 编写测试用例（如适用）

---

**项目状态**：核心功能已完成，第四阶段增强功能开发中

**最后更新**：2025-11-23

