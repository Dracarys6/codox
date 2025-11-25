-- ============================================
-- codox 一体化数据库迁移脚本（2025.11 Release）
-- 说明：
--
-- 使用方式（示例）：
--   PGPASSWORD=your_password psql -h 127.0.0.1 -p 5432 -U collab -d collab -f migration_all_2025_11.sql
--
-- 注意：
--   - 脚本内部大量使用 IF NOT EXISTS / IF EXISTS 判断，可重复执行，默认是幂等的。
--   - 仅适用于已经存在基础表结构（参考 init.sql）的数据库。
-- ============================================

-- ============================================
-- 1. 版本控制功能
-- ============================================

-- 1.1 document 表新增版本策略相关字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document' 
        AND column_name = 'version_strategy'
    ) THEN
        ALTER TABLE document 
        ADD COLUMN version_strategy VARCHAR(16) NOT NULL DEFAULT 'manual';
        RAISE NOTICE 'Added version_strategy column to document table';
    ELSE
        RAISE NOTICE 'version_strategy column already exists in document table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document' 
        AND column_name = 'version_auto_interval_minutes'
    ) THEN
        ALTER TABLE document 
        ADD COLUMN version_auto_interval_minutes INTEGER NOT NULL DEFAULT 30;
        RAISE NOTICE 'Added version_auto_interval_minutes column to document table';
    ELSE
        RAISE NOTICE 'version_auto_interval_minutes column already exists in document table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document' 
        AND column_name = 'version_retention_limit'
    ) THEN
        ALTER TABLE document 
        ADD COLUMN version_retention_limit INTEGER DEFAULT 50;
        RAISE NOTICE 'Added version_retention_limit column to document table';
    ELSE
        RAISE NOTICE 'version_retention_limit column already exists in document table';
    END IF;
END $$;

-- 1.2 document_version 表新增版本号与内容字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_version' 
        AND column_name = 'version_number'
    ) THEN
        ALTER TABLE document_version 
        ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1;

        WITH numbered_versions AS (
            SELECT 
                id,
                doc_id,
                ROW_NUMBER() OVER (PARTITION BY doc_id ORDER BY created_at ASC) as vnum
            FROM document_version
        )
        UPDATE document_version dv
        SET version_number = nv.vnum
        FROM numbered_versions nv
        WHERE dv.id = nv.id;

        RAISE NOTICE 'Added version_number column and populated existing records';
    ELSE
        RAISE NOTICE 'version_number column already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_version' 
        AND column_name = 'change_summary'
    ) THEN
        ALTER TABLE document_version 
        ADD COLUMN change_summary TEXT;
        RAISE NOTICE 'Added change_summary column';
    ELSE
        RAISE NOTICE 'change_summary column already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_version' 
        AND column_name = 'source'
    ) THEN
        ALTER TABLE document_version 
        ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'auto';
        RAISE NOTICE 'Added source column';
    ELSE
        RAISE NOTICE 'source column already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_version' 
        AND column_name = 'content_text'
    ) THEN
        ALTER TABLE document_version 
        ADD COLUMN content_text TEXT;
        RAISE NOTICE 'Added content_text column';
    ELSE
        RAISE NOTICE 'content_text column already exists';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_version' 
        AND column_name = 'content_html'
    ) THEN
        ALTER TABLE document_version 
        ADD COLUMN content_html TEXT;
        RAISE NOTICE 'Added content_html column';
    ELSE
        RAISE NOTICE 'content_html column already exists';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_version_doc_version 
ON document_version(doc_id, version_number DESC);

-- ============================================
-- 2. 文档状态字段
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE document 
        ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'draft';
        RAISE NOTICE 'Added status column to document table';
    ELSE
        RAISE NOTICE 'status column already exists in document table';
    END IF;
END $$;

-- 按现有数据初始化状态
UPDATE document 
SET status = CASE
    WHEN is_locked = TRUE THEN 'locked'
    WHEN last_published_version_id IS NOT NULL THEN 'published'
    WHEN EXISTS (
        SELECT 1 FROM document_version 
        WHERE document_version.doc_id = document.id
    ) THEN 'saved'
    ELSE 'draft'
END
WHERE status = 'draft' OR status IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_status ON document(status);

COMMENT ON COLUMN document.status IS '文档状态: draft(草稿), saved(已保存), published(已发布), archived(已归档), locked(已锁定)';

-- ============================================
-- 3. 通知增强
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notification_user_type ON notification(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_user_created ON notification(user_id, created_at DESC);

-- ============================================
-- 4. 管理员用户管理与满意度反馈
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'status'
    ) THEN
        ALTER TABLE "user"
            ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
        RAISE NOTICE 'Added status column to user table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'is_locked'
    ) THEN
        ALTER TABLE "user"
            ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE 'Added is_locked column to user table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'remark'
    ) THEN
        ALTER TABLE "user"
            ADD COLUMN remark TEXT;
        RAISE NOTICE 'Added remark column to user table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'last_login_at'
    ) THEN
        ALTER TABLE "user"
            ADD COLUMN last_login_at TIMESTAMPTZ;
        RAISE NOTICE 'Added last_login_at column to user table';
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    target_user_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_user_id);

CREATE TABLE IF NOT EXISTS user_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    dimension VARCHAR(100) NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_dimension ON user_feedback(dimension);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON user_feedback(user_id);

-- ============================================
-- 迁移结束（2025.11）
-- ============================================


