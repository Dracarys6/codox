-- ============================================
-- 第四阶段数据库迁移脚本
-- 功能：实时通讯、通知增强
-- ============================================

-- ============================================
-- 1. 实时通讯模块
-- ============================================

-- 聊天室表
CREATE TABLE chat_room (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(20) NOT NULL,  -- 'direct', 'group', 'document'
    doc_id BIGINT REFERENCES document(id) ON DELETE CASCADE,  -- 文档关联聊天室（可选）
    created_by BIGINT REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 聊天室成员表
CREATE TABLE chat_room_member (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES chat_room(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    UNIQUE(room_id, user_id)
);

-- 聊天消息表
CREATE TABLE chat_message (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES chat_room(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES "user"(id),
    content TEXT,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',  -- 'text', 'file', 'image', etc.
    file_url VARCHAR(500),  -- 文件消息的 URL（可选）
    reply_to BIGINT REFERENCES chat_message(id),  -- 回复消息（可选）
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 消息已读状态表
CREATE TABLE chat_message_read (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES chat_message(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- 聊天相关索引
CREATE INDEX idx_chat_room_doc ON chat_room(doc_id);
CREATE INDEX idx_chat_room_member_room ON chat_room_member(room_id);
CREATE INDEX idx_chat_room_member_user ON chat_room_member(user_id);
CREATE INDEX idx_chat_message_room_created ON chat_message(room_id, created_at DESC);
CREATE INDEX idx_chat_message_sender ON chat_message(sender_id);
CREATE INDEX idx_chat_message_read_user ON chat_message_read(user_id);

-- ============================================
-- 2. 通知系统增强
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
--   AND table_name IN ('chat_room', 'chat_room_member', 'chat_message', 'chat_message_read', 
--                      'notification_setting')
-- ORDER BY table_name;

