-- ============================================
-- 版本控制功能数据库迁移脚本
-- 为 document 和 document_version 表添加缺失的字段
-- ============================================

-- ============================================
-- 1. 更新 document 表
-- ============================================

-- 检查并添加 version_strategy 字段
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

-- 检查并添加 version_auto_interval_minutes 字段
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

-- 检查并添加 version_retention_limit 字段
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

-- ============================================
-- 2. 更新 document_version 表
-- ============================================

-- 检查并添加 version_number 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_version' 
        AND column_name = 'version_number'
    ) THEN
        -- 添加 version_number 字段
        ALTER TABLE document_version 
        ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1;
        
        -- 为现有记录生成版本号（按 doc_id 和 created_at 排序）
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

-- 检查并添加 change_summary 字段
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

-- 检查并添加 source 字段
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

-- 检查并添加 content_text 字段
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

-- 检查并添加 content_html 字段
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

-- 创建或更新索引
CREATE INDEX IF NOT EXISTS idx_document_version_doc_version 
ON document_version(doc_id, version_number DESC);

-- ============================================
-- 迁移完成
-- ============================================

-- 验证：检查表结构
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'document_version'
-- ORDER BY ordinal_position;

