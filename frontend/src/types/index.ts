// API 响应类型定义
export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
}

// 用户相关类型
export interface User {
    id: number;
    email: string;
    role: string;
    profile: {
        nickname: string;
        avatar_url: string;
        bio: string;
    };
}

export interface UserProfile {
    nickname: string;
    avatar_url: string;
    bio: string;
}

// 认证相关类型
export interface RegisterRequest {
    email: string;
    password: string;
    nickname?: string;
}

export interface RegisterResponse {
    id: number;
    email: string;
}

export interface LoginRequest {
    account: string; // 支持邮箱或手机号
    password: string;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    user: {
        id: number;
        email: string;
        role: string;
        nickname: string;
        avatar_url: string;
    };
}

export interface RefreshTokenRequest {
    refresh_token: string;
}

export interface RefreshTokenResponse {
    access_token: string;
}

// 更新用户资料请求
export interface UpdateProfileRequest {
    nickname?: string;
    bio?: string;
    avatar_url?: string;
}

// 文档相关类型
export interface Tag {
    id: number;
    name: string;
}

export interface Document {
    id: number;
    title: string;
    owner_id: number;
    is_locked: boolean;
    last_published_version_id?: number;
    tags: Tag[] | string[]; // 后端可能返回数组或字符串数组
    created_at: string;
    updated_at: string;
}

export interface CreateDocumentRequest {
    title: string;
    tags?: string[];
}

export interface UpdateDocumentRequest {
    title?: string;
    is_locked?: boolean;
    tags?: string[];
}

export interface DocumentListResponse {
    docs: Document[];
    total: number;
    page: number;
    pageSize: number;
}

export interface DocumentListParams {
    page?: number;
    pageSize?: number;
    tag?: string;
    author?: number;
}

// ACL 相关类型
export interface AclEntry {
    user_id: number;
    permission: 'owner' | 'editor' | 'viewer';
}

export interface DocumentAcl {
    doc_id: number;
    acl: AclEntry[];
}

export interface UpdateAclRequest {
    acl: AclEntry[];
}

// 版本相关类型
export interface DocumentVersion {
    id: number;
    doc_id: number;
    snapshot_url: string;
    snapshot_sha256: string;
    size_bytes: number;
    created_by: number;
    created_at: string;
}

export interface VersionListResponse {
    versions: DocumentVersion[];
}

export interface PublishVersionRequest {
    snapshot_url: string;
    sha256: string;
    size_bytes: number;
}

export interface PublishVersionResponse {
    version_id: number;
    doc_id: number;
    snapshot_url: string;
    created_at: string;
}

