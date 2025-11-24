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
    status?: string;
    is_locked?: boolean;
    remark?: string;
    last_login_at?: string;
    created_at?: string;
    updated_at?: string;
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
        status?: string;
        is_locked?: boolean;
        last_login_at?: string;
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

export interface ForgotPasswordRequest {
    email: string;
}

export interface ForgotPasswordResponse {
    message: string;
    reset_token?: string;
    expires_at?: string;
}

export interface ResetPasswordRequest {
    token: string;
    new_password: string;
}

export interface ResetPasswordResponse {
    message: string;
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

export type DocumentStatus = 'draft' | 'saved' | 'published' | 'archived' | 'locked';

export interface Document {
    id: number;
    title: string;
    owner_id: number;
    is_locked: boolean;
    status?: DocumentStatus; // 文档状态
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
    status?: DocumentStatus;
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
    status?: DocumentStatus; // 按状态筛选
}

// ACL 相关类型
export interface AclEntry {
    user_id: number;
    permission: 'owner' | 'editor' | 'viewer';
    email?: string; // 可选，用于显示
    nickname?: string; // 可选，用于显示
}

export interface DocumentAcl {
    doc_id: number;
    acl: AclEntry[];
}

export interface UpdateAclRequest {
    acl: AclEntry[];
}

// 通知相关类型
export interface NotificationItem {
    id: number;
    type: string;
    payload: Record<string, any>;
    is_read: boolean;
    created_at: string;
}

export interface NotificationListResponse {
    notifications: NotificationItem[];
    total: number;
    page: number;
    page_size: number;
}

export interface NotificationFilterParams {
    page?: number;
    page_size?: number;
    unread_only?: boolean;
    type?: string;
    doc_id?: number;
    start_date?: string;
    end_date?: string;
}

// 版本相关类型
export interface DocumentVersion {
    id: number;
    doc_id: number;
    version_number: number;
    snapshot_url: string;
    snapshot_sha256: string;
    size_bytes: number;
    created_by: number;
    change_summary?: string;
    source: 'auto' | 'manual' | 'restore';
    content_text?: string;
    content_html?: string;
    created_at: string;
    creator_email?: string;
    creator_nickname?: string;
}

export interface VersionListResponse {
    versions: DocumentVersion[];
}

export interface VersionListParams {
    start_date?: string;
    end_date?: string;
    created_by?: number;
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

export interface CreateVersionRequest {
    snapshot_url: string;
    sha256: string;
    size_bytes: number;
    change_summary?: string;
    content_text?: string;
    content_html?: string;
}

export interface CreateVersionResponse {
    version_id: number;
    version_number: number;
    doc_id: number;
    message: string;
}

export interface RestoreVersionResponse {
    version_id: number;
    version_number: number;
    doc_id: number;
    restored_from_version_id: number;
    message: string;
}

export interface DiffSegment {
    op: 'equal' | 'insert' | 'delete';
    text: string;
}

export interface VersionDiffResponse {
    base_version_id: number | null;
    target_version_id: number;
    diff: DiffSegment[];
}

export interface AdminUserStats {
    document_count: number;
    active_document_count: number;
    comment_count: number;
    completed_tasks: number;
}

export interface AdminUser extends User {
    stats: AdminUserStats;
}

export interface AdminUserListResponse {
    users: AdminUser[];
    total: number;
    page: number;
    page_size: number;
}

export interface AdminUserListParams {
    page?: number;
    page_size?: number;
    keyword?: string;
    role?: string;
    status?: string;
    is_locked?: boolean;
    sort_by?: 'created_at' | 'last_login_at' | 'document_count' | 'comment_count' | 'completed_tasks';
    sort_order?: 'asc' | 'desc';
}

export interface UserAnalyticsTotals {
    documents_created: number;
    comments_created: number;
    tasks_completed: number;
    active_users: number;
}

export interface UserAnalyticsTopUser {
    user_id: number;
    email: string;
    nickname: string;
    role: string;
    documents_created: number;
    comments_created: number;
    tasks_completed: number;
    last_login_at?: string;
}

export interface UserAnalyticsRoleStat {
    role: string;
    documents_created: number;
    comments_created: number;
    tasks_completed: number;
}

export interface UserAnalyticsResponse {
    range: { from: string; to: string };
    totals: UserAnalyticsTotals;
    top_users: UserAnalyticsTopUser[];
    role_breakdown: UserAnalyticsRoleStat[];
}

export interface SubmitFeedbackRequest {
    dimension: string;
    score: number;
    comment?: string;
}

export interface FeedbackSummaryItem {
    dimension: string;
    responses: number;
    avg_score: number;
}

export interface FeedbackEntry {
    id: number;
    user_id: number;
    dimension: string;
    score: number;
    comment: string;
    created_at: string;
    email: string;
    nickname: string;
}

export interface FeedbackStatsResponse {
    summary: FeedbackSummaryItem[];
    recent: FeedbackEntry[];
}

