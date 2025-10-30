# MultiuserDocument - C++/PostgreSQL 后端开发精简手册

## 步骤一：依赖安装

```bash
sudo apt update
sudo apt install -y build-essential cmake libpq-dev libpqxx-dev libssl-dev zlib1g-dev libjsoncpp-dev redis-server postgresql postgresql-contrib git
sudo service postgresql start
sudo service redis-server start
```

## 步骤二：初始化数据库（首次）

```bash
sudo -u postgres psql -c "CREATE DATABASE collab;"
sudo -u postgres psql -c "CREATE USER collab WITH PASSWORD 'collab_pass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE collab TO collab;"
```

## 步骤三：编译运行 C++ 服务

```bash
cd cpp-service
mkdir -p build && cd build
cmake ..
make -j$(nproc)

## 运行服务
./cpp-service
```

## 验证

```bash
curl http://localhost:8080/health
```

## 目录结构

```
├── cpp-service/    # 后端代码
│   ├── src/
│   ├── CMakeLists.txt
│   └── config.json
├── docs/           # 项目文档
└── README.md
```

## 常见易错点

- 依赖缺失：`libpqxx-dev`、`libpq-dev`
- 数据库未启动：`sudo service postgresql status`
- 端口冲突：修改 `config.json`

## 里程碑与开发阶段

1. 环境准备与基础启动（已完成，当前阶段）
   - 后端 C++/Drogon/PostgreSQL 编译&跑通
   - 数据库表结构初始化
   - 健康检查接口可用
2. 第一阶段开发
   - 用户认证与权限（JWT、RBAC/ACL）
   - 文档基础 CRUD（创建/编辑/删除/查询）
   - 基础接口单元测试/调试用例
3. 第二阶段
   - 实时协作 Yjs 对接（核心房间/光标交互）
   - 评论/任务/通知 API 流程实现
   - 文档标签、条件搜索、自动保存等扩展功能
4. 第三阶段（选做/完善）
   - 历史版本管理/回滚、全文搜索、PWA与移动端、监控审计

开发建议：每完成一个里程碑，保持接口文档、单测和数据库变更同步更新。

