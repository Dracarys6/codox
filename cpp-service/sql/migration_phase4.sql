-- ============================================
-- 第四阶段数据库迁移脚本
-- 功能：通知增强
-- ============================================

-- ============================================
-- 通知系统增强
-- ============================================

-- 通知设置表
CREATE TABLE notification_setting (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,  -- comment, task_assigned, task_status_changed, permission_changed, etc.
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, notification_type)
);

-- 通知表索引优化（如果不存在）
CREATE INDEX IF NOT EXISTS idx_notification_user_type ON notification(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_user_created ON notification(user_id, created_at DESC);

-- 通知设置索引
CREATE INDEX idx_notification_setting_user ON notification_setting(user_id);

-- ============================================
-- 迁移完成
-- ============================================

-- 验证：查询所有新创建的表
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('notification_setting')
-- ORDER BY table_name;

