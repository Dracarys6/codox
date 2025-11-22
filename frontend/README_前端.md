# 前端开发指南

## 第一阶段功能清单

✅ **已完成功能：**

- 用户注册和登录页面
- JWT Token 认证和管理
- Token 自动刷新机制
- 用户资料管理页面
- 路由守卫（Protected Route）
- 统一的 API 客户端封装
- 响应式导航栏
- 错误处理和提示

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

默认配置指向 `http://localhost:8080/api`，如果后端运行在不同地址，请修改 `.env` 文件。

### 3. 启动开发服务器

```bash
npm run dev
```

前端将在 `http://localhost:3000` 启动。

### 4. 构建生产版本

```bash
npm run build
```

## 项目结构

```.
frontend/
├── src/
│   ├── api/              # API 客户端
│   │   └── client.ts     # axios 封装和拦截器
│   ├── components/       # 通用组件
│   │   ├── Layout.tsx    # 布局组件
│   │   ├── Navbar.tsx    # 导航栏组件
│   │   └── ProtectedRoute.tsx  # 路由守卫
│   ├── contexts/         # React Context
│   │   └── AuthContext.tsx  # 认证上下文
│   ├── pages/            # 页面组件
│   │   ├── HomePage.tsx      # 首页
│   │   ├── LoginPage.tsx     # 登录页
│   │   ├── RegisterPage.tsx  # 注册页
│   │   └── ProfilePage.tsx   # 个人资料页
│   ├── types/            # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.tsx           # 主应用组件
│   └── main.tsx          # 入口文件
├── .env.example          # 环境变量示例
├── package.json
├── tailwind.config.js    # Tailwind CSS 配置
├── tsconfig.json         # TypeScript 配置
└── vite.config.ts        # Vite 配置
```

## 功能说明

### 认证流程

1. **登录**：用户输入账号（邮箱/手机号）和密码
2. **Token 存储**：登录成功后，access_token 和 refresh_token 存储在 localStorage
3. **自动刷新**：当 access_token 过期（401 错误）时，自动使用 refresh_token 刷新
4. **路由守卫**：未登录用户访问受保护页面时，自动跳转到登录页

### API 客户端

`src/api/client.ts` 提供了统一的 API 客户端，包含：

- 请求拦截器：自动添加 Authorization header
- 响应拦截器：自动处理 Token 刷新
- 类型安全的 API 方法

### 状态管理

使用 React Context (`AuthContext`) 管理用户认证状态：

- `user`: 当前用户信息
- `isLoading`: 加载状态
- `login()`: 登录方法
- `logout()`: 登出方法
- `updateUser()`: 更新用户信息

## 测试

### 手动测试流程

1. **注册新用户**
   - 访问 `/register`
   - 输入邮箱、密码和昵称
   - 注册成功后自动跳转到登录页

2. **登录**
   - 访问 `/login`
   - 输入账号和密码
   - 登录成功后跳转到首页

3. **查看个人资料**
   - 点击导航栏的"个人资料"
   - 查看和编辑个人信息

4. **登出**
   - 点击导航栏的"登出"按钮
   - 清除 Token 并跳转到登录页

## 下一步开发

## 已实现功能

### ACL 权限管理
- ✅ 权限列表展示（所有者、编辑者、查看者）
- ✅ 添加协作者（支持搜索数据库中的用户）
- ✅ 修改权限级别
- ✅ 移除协作者
- ✅ 用户搜索功能（按ID、邮箱、昵称）

### 用户搜索
在 ACL 管理界面中，支持：
- 实时搜索数据库中的用户
- 按用户ID、邮箱、昵称搜索
- 显示搜索结果下拉列表
- 自动标记已存在的用户

## 下一步开发

第二阶段前端开发将包括：

- 文档列表页面
- 文档创建/编辑页面
- 文档详情页面
- 版本历史查看

## 常见问题

### Token 刷新失败

如果 Token 刷新失败，会自动清除认证信息并跳转到登录页。这是正常的安全机制。

### CORS 错误

如果遇到 CORS 错误，请确保：

1. 后端已配置 CORS 允许前端域名
2. 开发环境使用 Vite 的代理配置（已在 `vite.config.ts` 中配置）

### API 请求失败

请检查：

1. 后端服务是否正在运行（默认 `http://localhost:8080`）
2. `.env` 文件中的 API 地址是否正确
3. 浏览器控制台的错误信息
