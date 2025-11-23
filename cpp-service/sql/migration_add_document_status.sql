-- ============================================
-- 文档状态功能数据库迁移脚本
-- 为 document 表添加 status 字段
-- ============================================

-- 检查并添加 status 字段
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

-- 更新现有文档的状态
-- 如果文档已锁定，设置为 'locked'
-- 如果文档有已发布版本，设置为 'published'
-- 否则根据是否有版本设置为 'saved' 或 'draft'
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

-- 添加状态索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_document_status ON document(status);

-- 添加注释说明状态值
COMMENT ON COLUMN document.status IS '文档状态: draft(草稿), saved(已保存), published(已发布), archived(已归档), locked(已锁定)';

