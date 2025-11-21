# 版本控制功能测试指南

本文档描述如何测试文档版本控制功能的各个组件。

## 功能概览

版本控制功能包括：
1. **版本列表查询** - 支持按时间范围、创建人过滤
2. **版本详情查看** - 查看单个版本的完整信息
3. **手动创建版本** - 用户手动保存版本并添加变更摘要
4. **版本恢复** - 恢复到指定版本，自动创建新版本记录
5. **版本差异对比** - 查看两个版本之间的内容差异

## 测试环境准备

1. **执行数据库迁移**（重要！）
   
   迁移脚本会更新两个表：
   - `document` 表：添加 `version_strategy`, `version_auto_interval_minutes`, `version_retention_limit`
   - `document_version` 表：添加 `version_number`, `change_summary`, `source`, `content_text`, `content_html`
   
   ```bash
   # 使用环境变量设置密码（推荐）
   PGPASSWORD=your_password psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/migration_version_control.sql
   
   # 或者使用密码提示
   psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/migration_version_control.sql
   ```
   
   **注意**：如果遇到 `version_retention_limit` 或 `version_number` 不存在的错误，必须执行此迁移脚本。

2. 确保后端服务运行在 `http://localhost:8080`
3. 确保前端服务运行在 `http://localhost:5173`
4. 准备至少一个测试文档和用户账号

## API 接口测试

### 1. 获取版本列表

**接口**: `GET /api/docs/{id}/versions`

**测试用例**:

```bash
# 基本查询
http GET http://localhost:8080/api/docs/1/versions \
  user_id==1 \
  "Authorization:Bearer YOUR_TOKEN"

# 按时间范围过滤
http GET http://localhost:8080/api/docs/1/versions \
  user_id==1 \
  start_date==2024-01-01 \
  end_date==2024-12-31 \
  "Authorization:Bearer YOUR_TOKEN"

# 按创建人过滤
http GET http://localhost:8080/api/docs/1/versions \
  user_id==1 \
  created_by==2 \
  "Authorization:Bearer YOUR_TOKEN"
```

**预期结果**:
- 返回版本列表，按版本号降序排列
- 包含版本号、创建时间、创建人、变更摘要等信息
- 支持过滤参数生效

### 2. 获取单个版本详情

**接口**: `GET /api/docs/{id}/versions/{versionId}`

**测试用例**:

```bash
http GET http://localhost:8080/api/docs/1/versions/1 \
  user_id==1 \
  "Authorization:Bearer YOUR_TOKEN"
```

**预期结果**:
- 返回指定版本的完整信息
- 包含快照 URL、SHA256、文件大小、内容文本/HTML 等

### 3. 手动创建版本

**接口**: `POST /api/docs/{id}/versions`

**测试用例**:

```bash
http POST http://localhost:8080/api/docs/1/versions \
  user_id==1 \
  "Authorization:Bearer YOUR_TOKEN" \
  snapshot_url="minio://snapshots/doc-1/v1.json" \
  sha256="abc123def456..." \
  size_bytes:=1024 \
  change_summary="添加了新的章节" \
  content_text="文档内容文本" \
  content_html="<p>文档内容HTML</p>"
```

**预期结果**:
- 创建新版本记录
- 版本号自动递增
- 来源标记为 "manual"
- 返回新版本的 ID 和版本号

### 4. 恢复版本

**接口**: `POST /api/docs/{id}/versions/{versionId}/restore`

**测试用例**:

```bash
http POST http://localhost:8080/api/docs/1/versions/2/restore \
  user_id==1 \
  "Authorization:Bearer YOUR_TOKEN"
```

**预期结果**:
- 创建新的版本记录（来源为 "restore"）
- 变更摘要包含 "Restored from version X"
- 更新文档的 `last_published_version_id`
- 返回新版本的 ID 和版本号

### 5. 获取版本差异

**接口**: `GET /api/docs/{id}/versions/{versionId}/diff`

**测试用例**:

```bash
# 与当前版本比较
http GET http://localhost:8080/api/docs/1/versions/2/diff \
  user_id==1 \
  "Authorization:Bearer YOUR_TOKEN"

# 与指定版本比较
http GET http://localhost:8080/api/docs/1/versions/2/diff \
  user_id==1 \
  base_version_id==1 \
  "Authorization:Bearer YOUR_TOKEN"
```

**预期结果**:
- 返回差异段数组
- 每个段包含操作类型（equal/insert/delete）和文本内容
- 支持行级别的差异对比

## 前端功能测试

### 1. 版本时间线组件

**测试步骤**:
1. 打开文档编辑页面
2. 点击侧边栏的"版本历史"区域
3. 点击"管理版本"按钮
4. 进入版本管理页面

**验证点**:
- 版本列表正确显示
- 支持按时间范围、创建人筛选
- 版本信息完整（版本号、创建时间、创建人、来源标签）
- 点击版本可以查看详情
- 可以执行恢复操作

### 2. 版本详情查看

**测试步骤**:
1. 在版本时间线中选择一个版本
2. 查看右侧版本详情面板

**验证点**:
- 显示版本号、创建时间、创建人
- 显示来源（自动/手动/恢复）
- 显示变更摘要（如果有）
- 显示文件大小和 SHA256

### 3. 版本差异对比

**测试步骤**:
1. 选择一个版本
2. 点击"查看差异"按钮
3. 查看差异视图

**验证点**:
- 差异内容正确显示
- 新增内容用绿色标记
- 删除内容用红色标记
- 未变更内容正常显示
- 显示差异统计信息

### 4. 版本恢复

**测试步骤**:
1. 选择一个历史版本
2. 点击"恢复"按钮
3. 确认恢复操作

**验证点**:
- 弹出确认对话框
- 恢复成功后创建新版本记录
- 新版本来源标记为 "restore"
- 版本列表自动刷新

### 5. 版本预览

**测试步骤**:
1. 选择一个版本
2. 点击"预览"按钮
3. 查看版本内容预览

**验证点**:
- 模态框正确显示
- 内容正确渲染（HTML 或文本）
- 可以关闭预览
- 可以从预览直接恢复版本

## 权限测试

### 1. 查看权限

- **viewer**: 可以查看版本列表和详情
- **editor**: 可以查看版本列表和详情，可以手动创建版本
- **owner**: 拥有所有权限，包括恢复版本

### 2. 创建版本权限

- 只有 **editor** 和 **owner** 可以手动创建版本
- **viewer** 尝试创建版本应返回 403 Forbidden

### 3. 恢复版本权限

- 只有 **owner** 可以恢复版本
- **editor** 和 **viewer** 尝试恢复版本应返回 403 Forbidden

## 边界情况测试

### 1. 空版本列表

- 文档没有任何版本时，应显示"暂无版本记录"

### 2. 版本内容为空

- 版本没有 `content_text` 或 `content_html` 时，预览应显示提示信息

### 3. 差异对比相同版本

- 比较相同版本时，应显示"两个版本内容相同"

### 4. 大文件版本

- 测试大文件版本的创建和下载
- 验证文件大小限制（20MB）

### 5. 版本号递增

- 验证版本号自动递增逻辑
- 删除版本后，新版本号应继续递增

## 性能测试

### 1. 大量版本

- 测试文档有 100+ 版本时的列表加载性能
- 验证分页功能（如果实现）

### 2. 大内容差异

- 测试大文件版本的差异计算性能
- 验证差异截断逻辑（超过 4000 行）

## 自动化测试建议

### 后端单元测试

```cpp
// 测试版本创建
TEST(VersionController, CreateVersion) {
    // 测试正常创建
    // 测试权限检查
    // 测试参数验证
}

// 测试版本恢复
TEST(VersionController, RestoreVersion) {
    // 测试正常恢复
    // 测试权限检查
    // 测试版本不存在的情况
}
```

### 前端组件测试

```typescript
// 测试版本时间线组件
describe('VersionTimeline', () => {
  it('should load and display versions', async () => {
    // 测试版本列表加载
  });
  
  it('should filter versions by date range', async () => {
    // 测试日期筛选
  });
});

// 测试版本差异视图
describe('VersionDiffView', () => {
  it('should display diff correctly', async () => {
    // 测试差异显示
  });
});
```

## 已知问题和限制

1. **差异计算**: 当前使用简单的行级别 diff，对于复杂格式可能不够精确
2. **版本清理**: 自动版本清理策略需要配置文档的 `version_retention_limit`
3. **并发创建**: 多个用户同时创建版本时，版本号可能冲突（需要事务处理）

## 后续改进建议

1. 实现版本分页功能
2. 支持版本标签和备注
3. 实现版本合并功能
4. 支持导出版本为独立文件
5. 实现版本差异的视觉化增强（如代码高亮）

