-- 用户与角色
CREATE TABLE "user" (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'viewer', -- admin/editor/viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_profile (
  user_id BIGINT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  nickname VARCHAR(64),
  avatar_url TEXT,
  bio TEXT
);

-- 密码重置令牌
CREATE TABLE password_reset_token (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_token_user ON password_reset_token(user_id);
CREATE INDEX idx_password_reset_token_hash ON password_reset_token(token_hash);

-- 文档与访问控制
CREATE TABLE document (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES "user"(id),
  title VARCHAR(255) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  last_published_version_id BIGINT,
  version_strategy VARCHAR(16) NOT NULL DEFAULT 'manual',
  version_auto_interval_minutes INTEGER NOT NULL DEFAULT 30,
  version_retention_limit INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doc_acl (
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL, -- owner/editor/viewer
  PRIMARY KEY (doc_id, user_id)
);

-- 文档版本（快照元数据 + 存储位置）
CREATE TABLE document_version (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot_url TEXT NOT NULL,
  snapshot_sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES "user"(id),
  change_summary TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'auto',
  content_text TEXT,
  content_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_version_doc_version ON document_version(doc_id, version_number DESC);

-- 标签
CREATE TABLE tag (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL
);

CREATE TABLE doc_tag (
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (doc_id, tag_id)
);

-- 评论
CREATE TABLE comment (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES "user"(id),
  anchor JSONB,
  content TEXT NOT NULL,
  parent_id BIGINT REFERENCES comment(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 任务
CREATE TABLE task (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  assignee_id BIGINT REFERENCES "user"(id),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'todo', -- todo/doing/done
  due_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 通知
CREATE TABLE notification (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_document_owner_updated ON document(owner_id, updated_at DESC);
CREATE INDEX idx_doc_tag_tag ON doc_tag(tag_id);
CREATE INDEX idx_comment_doc_created ON comment(doc_id, created_at DESC);
CREATE INDEX idx_task_doc_status ON task(doc_id, status);

