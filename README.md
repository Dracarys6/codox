# 多人协作文档（C++ + Yjs）

这是一个多人实时协作文档系统：后端使用 C++（Drogon + libpqxx），实时协作基于 Yjs（y-websocket），依赖通过 Docker Compose 启动。

## 快速开始（WSL2 Ubuntu 20.04）

1. 安装依赖
   - `sudo apt update && sudo apt install -y build-essential cmake libpq-dev libpqxx-dev libssl-dev`
   - 安装 Docker Desktop（启用 WSL 集成）或在 WSL2 内安装 Docker Engine

2. 启动依赖服务
   - `cd docker`
   - 在 `docker` 目录创建 `.env`（参考下方示例）
   - `docker compose up -d`

3. 构建后端服务
   - `mkdir -p cpp-service/build && cd cpp-service/build`
   - `cmake .. && cmake --build . -j`

4. 运行与自检
   - `DB_URI='postgresql://collab:collab_pass@127.0.0.1:5432/collab?connect_timeout=3' ./cpp-service`
   - `curl http://127.0.0.1:8080/health`

## docker/.env 示例

```
DB_NAME=collab
DB_USER=collab
DB_PASSWORD=collab_pass
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
MEILI_MASTER_KEY=
```

## 仓库结构

- `cpp-service`: C++ 后端（Drogon, libpqxx）
- `docker`: Compose 依赖（开发用 PostgreSQL、Redis、MinIO、Meilisearch、y-websocket）
- `docs`: 设计文档（总体/详细），数据模型与 API 说明

## 为什么要上 GitHub 仓库

- 版本管理与回滚
- 多人协作（PR/Code Review）、Issue 与里程碑
- GitHub Actions 实现自动构建/测试
- 可私有开发，后续转公开作为作品展示

## 许可证

TBD

---

## 项目特性（当前与规划）

- C++ 后端（Drogon）+ libpqxx 直连 openGauss/PostgreSQL
- 实时协作（Yjs + y-websocket），多人光标/冲突合并（后续接入）
- 文档版本化与快照（对象存储 MinIO），全文检索（Meilisearch）
- RBAC + 文档级 ACL，评论/任务/通知（规划）

## 开发环境（建议）

- WSL2 + Ubuntu 20.04（推荐）/ 原生 Ubuntu 20.04/22.04
- 编译器与工具：GCC/Clang、CMake ≥ 3.24、Node.js 18+、Docker 24+ / Compose v2
- 依赖服务：PostgreSQL(开发替代)/openGauss、Redis、MinIO、Meilisearch、y-websocket

## 使用 openGauss 的说明

- 生产/评测环境建议直连 openGauss；开发期可用 PostgreSQL 14 作为替代（协议兼容）。
- 使用 libpqxx 连接：`postgresql://user:pass@host:5432/db?connect_timeout=3`
- 若数据库端口为 5432/5433 以实际为准；确保放通客户端访问，字符集 UTF8。

## WSL2 注意事项

- 源码建议放在 WSL2 的 Linux 文件系统（如 `~/projects`），避免跨盘 IO 慢。
- Docker Desktop 启用 WSL 集成，或在 WSL2 内安装 Docker Engine。
- 访问本机服务均用 `127.0.0.1:端口`。

## 常见问题（FAQ）

1) `git branch -M main` 报错 refname not found
   - 先提交一次：`git add . && git commit -m "init"`，再重命名；或 `git init -b main` 直接创建主分支。
2) `git push -u origin main` 提示 `src refspec main does not match any`
   - 本地没有 main 或没有提交；按上一步先创建 main 并提交，再推送。
3) 端口被占用
   - 修改 `docker-compose.yml` 或停止占用该端口的进程。
4) 健康检查不通/DB 报错
   - 确认 Postgres/ openGauss 已启动、账号密码正确、`DB_URI` 主机与端口可达。

## GitHub 建库与推送（私有仓库）

1) GitHub 新建仓库（Private），如 `MultiuserDocument`
2) 本地执行：

```
git init -b main
git add .
git commit -m "init"
git remote add origin https://github.com/<你的用户名>/MultiuserDocument.git
git push -u origin main
```
