# MinIO 配置检查指南

本文档介绍如何检查和配置 MinIO 存储服务。

## 快速检查

### 方法 1: 使用检查脚本（推荐）

```bash
cd cpp-service
./check_minio.sh
```

### 方法 2: 手动检查

#### 1. 检查配置文件

查看 `cpp-service/config.json` 中的 MinIO 配置：

```json
{
  "app": {
    "minio_endpoint": "localhost:9000",
    "minio_access_key": "minioadmin",
    "minio_secret_key": "minioadmin",
    "minio_bucket": "documents"
  }
}
```

#### 2. 检查 MinIO 服务状态

```bash
# 如果使用 Docker Compose
docker-compose ps minio

# 检查端口是否开放
nc -zv localhost 9000

# 或使用 telnet
telnet localhost 9000
```

#### 3. 测试 HTTP 连接

```bash
curl http://localhost:9000
```

应该返回 MinIO 的响应（可能是 200、403 或 307 重定向）。

#### 4. 访问 MinIO Console

打开浏览器访问：`http://localhost:9000`

使用配置中的 `minio_access_key` 和 `minio_secret_key` 登录。

#### 5. 检查 Bucket 是否存在

在 MinIO Console 中：
1. 登录后查看左侧的 Buckets 列表
2. 确认 `documents` bucket 存在
3. 如果不存在，点击 "Create Bucket" 创建

或使用 MinIO Client (mc):

```bash
# 安装 MinIO Client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# 配置别名
mc alias set myminio http://localhost:9000 minioadmin minioadmin

# 列出所有 Buckets
mc ls myminio

# 检查特定 Bucket
mc ls myminio/documents

# 如果不存在，创建 Bucket
mc mb myminio/documents
```

## 常见问题排查

### 问题 1: MinIO 服务未运行

**症状**: 连接失败，端口无法访问

**解决方案**:
```bash
# 启动 MinIO 服务
docker-compose up -d minio

# 检查日志
docker-compose logs minio
```

### 问题 2: Bucket 不存在

**症状**: 上传文件时返回 404 错误

**解决方案**:
1. 访问 MinIO Console: `http://localhost:9000`
2. 使用 Access Key 和 Secret Key 登录
3. 创建名为 `documents` 的 Bucket
4. 设置 Bucket 策略为 "Public" 或根据需要配置

### 问题 3: 认证失败

**症状**: 上传文件时返回 403 Forbidden

**检查项**:
1. 确认 `minio_access_key` 和 `minio_secret_key` 正确
2. 检查 MinIO 服务配置的凭据是否匹配
3. 查看后端日志中的详细错误信息

### 问题 4: 网络连接问题

**症状**: 无法连接到 MinIO 服务

**检查项**:
1. 确认 `minio_endpoint` 配置正确
2. 如果 MinIO 运行在 Docker 中，确认端口映射正确
3. 检查防火墙设置
4. 如果使用 Docker Compose，确认网络配置正确

## 测试上传功能

### 使用 curl 测试

```bash
# 准备测试文件
echo "test content" > test.txt

# 使用 MinIO Client 上传
mc cp test.txt myminio/documents/test/

# 或使用 S3 API（需要签名）
# 这比较复杂，建议使用 MinIO Client 或后端 API
```

### 通过后端 API 测试

1. 启动后端服务
2. 在前端创建文档并编辑
3. 查看后端日志，确认上传请求
4. 检查 MinIO Console，确认文件已上传

## 配置验证清单

- [ ] `config.json` 中存在 MinIO 配置
- [ ] `minio_endpoint` 格式正确（host:port）
- [ ] `minio_access_key` 和 `minio_secret_key` 已设置
- [ ] `minio_bucket` 已配置
- [ ] MinIO 服务正在运行
- [ ] 可以访问 MinIO Console
- [ ] Bucket 已创建
- [ ] 后端可以连接到 MinIO
- [ ] 测试上传功能正常

## 生产环境建议

1. **使用 HTTPS**: 配置 MinIO 使用 TLS/SSL
2. **强密码**: 使用强密码替代默认的 `minioadmin`
3. **访问策略**: 配置适当的 Bucket 策略
4. **备份**: 定期备份 MinIO 数据
5. **监控**: 设置监控和告警

## 相关文件

- 配置文件: `cpp-service/config.json`
- MinIO 客户端: `cpp-service/src/utils/MinIOClient.cc`
- 检查脚本: `cpp-service/check_minio.sh`
- Docker Compose: `docker-compose.yml`

