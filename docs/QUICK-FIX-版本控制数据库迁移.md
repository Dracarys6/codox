# 版本控制功能数据库迁移快速修复

## 问题描述

执行版本控制相关 API 时出现错误：
```
Database error: ERROR: column dv.version_number does not exist
```

## 原因

数据库中的 `document_version` 表缺少以下字段：
- `version_number` - 版本号
- `change_summary` - 变更摘要
- `source` - 版本来源（auto/manual/restore）
- `content_text` - 内容文本
- `content_html` - 内容 HTML

## 解决方案

执行迁移脚本添加缺失的字段：

```bash
# 方法 1: 使用密码提示
psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/migration_version_control.sql

# 方法 2: 使用环境变量（推荐）
PGPASSWORD=your_password psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/migration_version_control.sql

# 方法 3: 使用 .pgpass 文件
# 在 ~/.pgpass 中添加：127.0.0.1:5432:collab:collab:your_password
psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/migration_version_control.sql
```

## 迁移脚本说明

迁移脚本 `migration_version_control.sql` 会：

### 1. 更新 `document` 表
- **`version_strategy`** (VARCHAR(16)) - 版本策略，默认 'manual'
- **`version_auto_interval_minutes`** (INTEGER) - 自动版本间隔，默认 30 分钟
- **`version_retention_limit`** (INTEGER) - 版本保留限制，默认 50

### 2. 更新 `document_version` 表
- **`version_number`** (INTEGER) - 版本号，默认 1
  - 为现有记录自动生成版本号（按 doc_id 和 created_at 排序）
- **`change_summary`** (TEXT) - 变更摘要，可选
- **`source`** (VARCHAR(20)) - 版本来源，默认 'auto'
- **`content_text`** (TEXT) - 内容文本，可选
- **`content_html`** (TEXT) - 内容 HTML，可选

### 3. 创建索引
- 在 `document_version(doc_id, version_number DESC)` 上创建索引以优化查询

## 验证迁移

执行迁移后，可以验证表结构：

```sql
-- 连接到数据库
psql -h 127.0.0.1 -p 5432 -U collab -d collab

-- 查看表结构
\d document_version

-- 或者使用 SQL 查询
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'document_version'
ORDER BY ordinal_position;
```

**`document` 表应该包含**：
- `id`
- `owner_id`
- `title`
- `is_locked`
- `last_published_version_id`
- `version_strategy` ✅
- `version_auto_interval_minutes` ✅
- `version_retention_limit` ✅
- `created_at`
- `updated_at`

**`document_version` 表应该包含**：
- `id`
- `doc_id`
- `version_number` ✅
- `snapshot_url`
- `snapshot_sha256`
- `size_bytes`
- `created_by`
- `change_summary` ✅
- `source` ✅
- `content_text` ✅
- `content_html` ✅
- `created_at`

## 注意事项

1. **数据安全**：迁移脚本使用 `IF NOT EXISTS` 检查，可以安全地多次执行
2. **现有数据**：如果表中已有数据，`version_number` 会自动为现有记录生成版本号
3. **索引**：迁移脚本会创建索引以优化查询性能

## 如果迁移失败

如果迁移过程中出现错误，可以手动执行 SQL：

```sql
-- 连接到数据库
psql -h 127.0.0.1 -p 5432 -U collab -d collab

-- 手动添加 document 表字段（如果迁移脚本失败）
ALTER TABLE document ADD COLUMN IF NOT EXISTS version_strategy VARCHAR(16) NOT NULL DEFAULT 'manual';
ALTER TABLE document ADD COLUMN IF NOT EXISTS version_auto_interval_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE document ADD COLUMN IF NOT EXISTS version_retention_limit INTEGER DEFAULT 50;

-- 手动添加 document_version 表字段（如果迁移脚本失败）
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'auto';
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE document_version ADD COLUMN IF NOT EXISTS content_html TEXT;

-- 为现有记录生成版本号
WITH numbered_versions AS (
    SELECT 
        id,
        doc_id,
        ROW_NUMBER() OVER (PARTITION BY doc_id ORDER BY created_at ASC) as vnum
    FROM document_version
    WHERE version_number IS NULL OR version_number = 1
)
UPDATE document_version dv
SET version_number = nv.vnum
FROM numbered_versions nv
WHERE dv.id = nv.id;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_document_version_doc_version 
ON document_version(doc_id, version_number DESC);
```

