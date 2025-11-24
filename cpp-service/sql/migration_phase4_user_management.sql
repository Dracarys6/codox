DO $$
BEGIN
    -- 1) 用户表补充状态、锁定、备注、最近登录字段
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

-- 2) 管理员审计日志表
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

-- 3) 用户满意度反馈表
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