import axios, {AxiosError, AxiosInstance} from 'axios';

import {AdminUser, AdminUserListParams, AdminUserListResponse, CreateDocumentRequest, CreateVersionRequest, CreateVersionResponse, Document, DocumentAcl, DocumentListParams, DocumentListResponse, DocumentVersion, FeedbackStatsResponse, ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, LoginResponse, NotificationFilterParams, NotificationListResponse, PublishVersionRequest, PublishVersionResponse, RefreshTokenRequest, RefreshTokenResponse, RegisterRequest, RegisterResponse, ResetPasswordRequest, ResetPasswordResponse, RestoreVersionResponse, SubmitFeedbackRequest, UpdateAclRequest, UpdateDocumentRequest, UpdateProfileRequest, User, UserAnalyticsResponse, VersionDiffResponse, VersionListParams, VersionListResponse,} from '../types';

// 确保在开发环境中使用相对路径，避免 CORS 问题
const getApiBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    // 如果是开发环境且设置了完整 URL，警告并强制使用相对路径
    if (import.meta.env.DEV && envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
        console.warn('[API] 开发环境检测到完整 URL，将使用相对路径以避免 CORS 问题:', envUrl);
        console.warn('[API] 请使用 Vite 代理，确保 vite.config.ts 中配置了 /api 代理');
        return '/api';
    }
    return envUrl || '/api';
};

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        const baseURL = getApiBaseUrl();
        this.client = axios.create({
            baseURL: baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.setupInterceptors();
    }

    private setupInterceptors() {
        // 请求拦截器：添加 Token
        this.client.interceptors.request.use(
                (config) => {
                    const token = localStorage.getItem('access_token');
                    if (token) {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                    return config;
                },
                (error) => {
                    return Promise.reject(error);
                });

        // 响应拦截器：处理 Token 刷新
        this.client.interceptors.response.use((response) => response, async (error: AxiosError) => {
            const originalRequest = error.config as any;

            // 如果是 401 错误且未重试过
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;

                const refreshToken = localStorage.getItem('refresh_token');
                if (refreshToken) {
                    try {
                        const response = await this.refreshToken({
                            refresh_token: refreshToken,
                        });

                        localStorage.setItem('access_token', response.access_token);

                        // 更新请求头并重试
                        originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
                        return this.client(originalRequest);
                    } catch (refreshError) {
                        // 刷新失败，清除 token 并跳转登录
                        this.clearAuth();
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                } else {
                    this.clearAuth();
                    window.location.href = '/login';
                }
            }

            return Promise.reject(error);
        });
    }

    // 清除认证信息
    private clearAuth() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    }

    // ========== 认证相关 API ==========

    /**
     * 用户注册
     */
    async register(data: RegisterRequest): Promise<RegisterResponse> {
        const response = await this.client.post<RegisterResponse>('/auth/register', data);
        return response.data;
    }

    /**
     * 用户登录
     */
    async login(data: LoginRequest): Promise<LoginResponse> {
        const response = await this.client.post<LoginResponse>('/auth/login', data);

        // 保存 Token 和用户信息
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        return response.data;
    }

    /**
     * 刷新 Token
     */
    async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
        const response = await this.client.post<RefreshTokenResponse>('/auth/refresh', data);

        localStorage.setItem('access_token', response.data.access_token);

        return response.data;
    }

    /**
     * 申请密码重置令牌
     */
    async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
        const response = await this.client.post<ForgotPasswordResponse>('/auth/password/forgot', data);
        return response.data;
    }

    /**
     * 使用令牌重置密码
     */
    async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
        const response = await this.client.post<ResetPasswordResponse>('/auth/password/reset', data);
        return response.data;
    }

    /**
     * 登出
     */
    logout() {
        this.clearAuth();
    }

    // ========== 用户相关 API ==========

    /**
     * 获取当前用户信息
     */
    async getCurrentUser(): Promise<User> {
        const response = await this.client.get<User>('/users/me');
        return response.data;
    }

    /**
     * 更新当前用户信息
     */
    async updateProfile(data: UpdateProfileRequest): Promise<User> {
        const response = await this.client.patch<User>('/users/me', data);

        // 更新本地存储的用户信息
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            const updatedUser = {...user, ...response.data};
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        return response.data;
    }

    /**
     * 搜索用户
     */
    async searchUsers(query: string, params?: {page?: number; page_size?: number}):
            Promise<{users: User[]; total: number; page: number; page_size: number}> {
        const response = await this.client.get<{users: User[]; total: number; page: number; page_size: number}>(
                '/users/search', {
                    params: {q: query, ...params},
                });
        return response.data;
    }

    // ========== 文档相关 API ==========

    /**
     * 创建文档
     */
    async createDocument(data: CreateDocumentRequest): Promise<Document> {
        const response = await this.client.post<Document>('/docs', data);
        return response.data;
    }

    /**
     * 获取文档列表
     */
    async getDocumentList(params?: DocumentListParams): Promise<DocumentListResponse> {
        const response = await this.client.get<DocumentListResponse>('/docs', {params});
        return response.data;
    }

    /**
     * 获取文档详情
     */
    async getDocument(id: number): Promise<Document> {
        const response = await this.client.get<Document>(`/docs/${id}`);
        return response.data;
    }

    /**
     * 获取当前用户在文档上的权限（owner/editor/viewer/none）
     */
    async getDocumentPermission(id: number): Promise<{permission: 'owner' | 'editor' | 'viewer' | 'none'}> {
        const response =
                await this.client.get<{permission: 'owner' | 'editor' | 'viewer' | 'none'}>(`/docs/${id}/permission`);
        return response.data;
    }

    /**
     * 更新文档
     */
    async updateDocument(id: number, data: UpdateDocumentRequest): Promise<Document> {
        const response = await this.client.patch<Document>(`/docs/${id}`, data);
        return response.data;
    }

    /**
     * 删除文档
     */
    async deleteDocument(id: number): Promise<{message: string; id: number}> {
        const response = await this.client.delete<{message: string; id: number}>(`/docs/${id}`);
        return response.data;
    }

    /**
     * 获取文档 ACL
     */
    async getDocumentAcl(id: number): Promise<DocumentAcl> {
        const response = await this.client.get<DocumentAcl>(`/docs/${id}/acl`);
        return response.data;
    }

    /**
     * 更新文档 ACL
     */
    async updateDocumentAcl(id: number, data: UpdateAclRequest): Promise<DocumentAcl> {
        const response = await this.client.put<DocumentAcl>(`/docs/${id}/acl`, data);
        return response.data;
    }

    /**
     * 获取文档版本列表
     */
    async getDocumentVersions(id: number, params?: VersionListParams): Promise<VersionListResponse> {
        const response = await this.client.get<VersionListResponse>(`/docs/${id}/versions`, {params});
        return response.data;
    }

    /**
     * 获取单个版本详情
     */
    async getDocumentVersion(docId: number, versionId: number): Promise<DocumentVersion> {
        const response = await this.client.get<DocumentVersion>(`/docs/${docId}/versions/${versionId}`);
        return response.data;
    }

    /**
     * 手动创建版本
     */
    async createVersion(docId: number, data: CreateVersionRequest): Promise<CreateVersionResponse> {
        const response = await this.client.post<CreateVersionResponse>(`/docs/${docId}/versions`, data);
        return response.data;
    }

    /**
     * 恢复版本
     */
    async restoreVersion(docId: number, versionId: number): Promise<RestoreVersionResponse> {
        const response = await this.client.post<RestoreVersionResponse>(`/docs/${docId}/versions/${versionId}/restore`);
        return response.data;
    }

    /**
     * 获取版本差异
     */
    async getVersionDiff(docId: number, versionId: number, baseVersionId?: number): Promise<VersionDiffResponse> {
        const params = baseVersionId ? {base_version_id: baseVersionId} : {};
        const response =
                await this.client.get<VersionDiffResponse>(`/docs/${docId}/versions/${versionId}/diff`, {params});
        return response.data;
    }

    /**
     * 发布文档版本（保留向后兼容）
     */
    async publishVersion(id: number, data: PublishVersionRequest): Promise<PublishVersionResponse> {
        const response = await this.client.post<PublishVersionResponse>(`/docs/${id}/publish`, data);
        return response.data;
    }

    /**
     * 回滚到指定版本（保留向后兼容，实际调用 restoreVersion）
     */
    async rollbackVersion(docId: number, versionId: number):
            Promise<{message: string; version_id: number; doc_id: number}> {
        const result = await this.restoreVersion(docId, versionId);
        return {
            message: result.message,
            version_id: result.version_id,
            doc_id: result.doc_id,
        };
    }

    // ========== 协作相关 API ==========

    /**
     * 获取协作令牌
     */
    async getCollaborationToken(docId: number): Promise<{token: string; expiresIn: number}> {
        const response = await this.client.post<{token: string; expiresIn: number}>('/collab/token', {
            doc_id: docId,
        });
        return response.data;
    }

    /**
     * 获取引导快照
     */
    async getBootstrap(docId: number): Promise<{
        snapshot_url: string | null; sha256: string | null; version_id: number | null;
        content_html?: string | null;
        content_text?: string | null;
    }> {
        const response = await this.client.get<{
            snapshot_url: string | null; sha256: string | null; version_id: number | null;
            content_html?: string | null;
            content_text?: string | null;
        }>(`/collab/bootstrap/${docId}`);
        return response.data;
    }

    /**
     * 下载快照文件（通过后端代理）
     */
    async downloadSnapshot(docId: number): Promise<ArrayBuffer> {
        const response = await this.client.get(
                `/collab/snapshot/${docId}/download`,
                {responseType: 'arraybuffer', headers: {'Accept': 'application/octet-stream'}});
        return response.data as ArrayBuffer;
    }

    /**
     * 上传快照文件到 MinIO
     */
    async uploadSnapshot(docId: number, data: {data: string; filename?: string}):
            Promise<{snapshot_url: string; message: string}> {
        const response =
                await this.client.post<{snapshot_url: string; message: string}>(`/collab/upload/${docId}`, data);
        return response.data;
    }

    /**
     * 保存快照元数据（使用 JWT 认证）
     */
    async saveSnapshot(docId: number, data: {
        snapshot_url: string; sha256: string; size_bytes: number;
        content_html?: string;
        content_text?: string
    }): Promise<{version_id: number; message: string}> {
        const response =
                await this.client.post<{version_id: number; message: string}>(`/collab/snapshot/${docId}/save`, data);
        return response.data;
    }

    // ========== 评论相关 API ==========

    /**
     * 获取文档评论列表
     */
    async getComments(docId: number): Promise<{comments: any[]}> {
        const response = await this.client.get<{comments: any[]}>(`/docs/${docId}/comments`);
        return response.data;
    }

    /**
     * 创建评论
     */
    async createComment(docId: number, data: {content: string; anchor?: any; parent_id?: number}): Promise<any> {
        const response = await this.client.post<any>(`/docs/${docId}/comments`, data);
        return response.data;
    }

    /**
     * 删除评论
     */
    async deleteComment(commentId: number): Promise<{message: string}> {
        const response = await this.client.delete<{message: string}>(`/comments/${commentId}`);
        return response.data;
    }

    // ========== 任务相关 API ==========

    /**
     * 获取文档任务列表
     */
    async getTasks(docId: number): Promise<{tasks: any[]}> {
        const response = await this.client.get<{tasks: any[]}>(`/docs/${docId}/tasks`);
        return response.data;
    }

    /**
     * 创建任务
     */
    async createTask(docId: number, data: {title: string; assignee_id?: number; due_at?: string}): Promise<any> {
        const response = await this.client.post<any>(`/docs/${docId}/tasks`, data);
        return response.data;
    }

    /**
     * 更新任务
     */
    async updateTask(taskId: number, data: {status?: string; title?: string; assignee_id?: number; due_at?: string}):
            Promise<any> {
        const response = await this.client.patch<any>(`/tasks/${taskId}`, data);
        return response.data;
    }

    /**
     * 删除任务
     */
    async deleteTask(taskId: number): Promise<{message: string}> {
        const response = await this.client.delete<{message: string}>(`/tasks/${taskId}`);
        return response.data;
    }

    // ========== 通知相关 API ==========

    /**
     * 获取通知列表
     */
    async getNotifications(params?: NotificationFilterParams): Promise<NotificationListResponse> {
        const response = await this.client.get<NotificationListResponse>('/notifications', {params});
        return response.data;
    }

    /**
     * 标记通知为已读
     */
    async markNotificationsAsRead(notificationIds: number[]): Promise<{message: string}> {
        const response = await this.client.post<{message: string}>('/notifications/read', {
            notification_ids: notificationIds,
        });
        return response.data;
    }

    /**
     * 获取未读通知数量
     */
    async getUnreadNotificationCount(): Promise<{unread_count: number}> {
        const response = await this.client.get<{unread_count: number}>('/notifications/unread-count');
        return response.data;
    }

    // ========== 管理员相关 API ==========

    async getAdminUsers(params?: AdminUserListParams): Promise<AdminUserListResponse> {
        const response = await this.client.get<AdminUserListResponse>('/admin/users', {params});
        return response.data;
    }

    async exportAdminUsers(params?: AdminUserListParams): Promise<Blob> {
        const response = await this.client.get('/admin/users/export', {
            params,
            responseType: 'blob',
        });
        return response.data as Blob;
    }

    async updateAdminUser(userId: number, data: {status?: string; is_locked?: boolean; remark?: string}):
            Promise<{message: string; user: AdminUser}> {
        const response = await this.client.patch<{message: string; user: AdminUser}>(`/admin/users/${userId}`, data);
        return response.data;
    }

    async updateAdminUserRoles(userId: number, roleOrRoles: string|string[]):
            Promise<{message: string; user: AdminUser}> {
        const payload = typeof roleOrRoles === 'string' ? {role: roleOrRoles} : {
            roles: roleOrRoles,
        };
        const response =
                await this.client.post<{message: string; user: AdminUser}>(`/admin/users/${userId}/roles`, payload);
        return response.data;
    }

    async getUserAnalytics(params?: {from?: string; to?: string; limit?: number}): Promise<UserAnalyticsResponse> {
        const response = await this.client.get<UserAnalyticsResponse>('/admin/user-analytics', {params});
        return response.data;
    }

    // ========== 反馈相关 API ==========

    async submitFeedback(data: SubmitFeedbackRequest):
            Promise<{message: string; feedback_id: number; created_at: string}> {
        const response =
                await this.client.post<{message: string; feedback_id: number; created_at: string}>('/feedback', data);
        return response.data;
    }

    async getFeedbackStats(params?: {dimension?: string; limit?: number}): Promise<FeedbackStatsResponse> {
        const response = await this.client.get<FeedbackStatsResponse>('/feedback/stat', {params});
        return response.data;
    }

    // ========== 搜索相关 API ==========

    /**
     * 搜索文档
     */
    async searchDocuments(query: string, params?: {page?: number; page_size?: number}):
            Promise<{hits: any[]; total: number}> {
        const response = await this.client.get<{hits: any[]; total: number}>('/search', {
            params: {q: query, ...params},
        });
        return response.data;
    }

    // ========== 工具方法 ==========

    /**
     * 检查是否已登录
     */
    isAuthenticated(): boolean {
        return !!localStorage.getItem('access_token');
    }

    // ========== 文档导入导出 API ==========

    /**
     * 导入 Markdown 文档
     * 支持两种方式：
     * 1. 文件上传：传入 File 对象
     * 2. 文本内容：传入 { markdown: string, title?: string }
     */
    async importMarkdown(fileOrData: File|{
        markdown: string;
        title?: string
    }): Promise<Document> {
        if (fileOrData instanceof File) {
            // 文件上传方式
            const formData = new FormData();
            formData.append('file', fileOrData);
            const response = await this.client.post<Document>('/docs/import/markdown', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } else {
            // JSON 文本方式
            const response = await this.client.post<Document>('/docs/import/markdown', fileOrData);
            return response.data;
        }
    }

    /**
     * 导出 Word 文档（流式二进制下载）
     */
    async exportWord(docId: number): Promise<{blob: Blob; filename: string; mime_type: string}> {
        const response = await this.client.get<Blob>(`/docs/${docId}/export/word`, {
            responseType: 'blob',
        });

        // 从 Content-Disposition 中解析文件名
        const disposition = (response.headers['content-disposition'] as string | undefined) || '';
        let filename = `document-${docId}.docx`;
        const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)/i) ||
                disposition.match(/filename="?([^\";]+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
            try {
                filename = decodeURIComponent(filenameMatch[1]);
            } catch {
                filename = filenameMatch[1];
            }
        }

        const mimeType = (response.headers['content-type'] as string | undefined) ||
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        return {
            blob: response.data,
            filename,
            mime_type: mimeType,
        };
    }

    /**
     * 导出 PDF 文档（流式二进制下载）
     */
    async exportPdf(docId: number): Promise<{blob: Blob; filename: string; mime_type: string}> {
        const response = await this.client.get<Blob>(`/docs/${docId}/export/pdf`, {
            responseType: 'blob',
        });

        const disposition = (response.headers['content-disposition'] as string | undefined) || '';
        let filename = `document-${docId}.pdf`;
        const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)/i) ||
                disposition.match(/filename="?([^\";]+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
            try {
                filename = decodeURIComponent(filenameMatch[1]);
            } catch {
                filename = filenameMatch[1];
            }
        }

        const mimeType = (response.headers['content-type'] as string | undefined) || 'application/pdf';

        return {
            blob: response.data,
            filename,
            mime_type: mimeType,
        };
    }

    /**
     * 导出 Markdown 文档
     */
    async exportMarkdown(docId: number): Promise<{markdown: string; filename: string; mime_type: string}> {
        const response = await this.client.get<{markdown: string; filename: string; mime_type: string}>(
                `/docs/${docId}/export/markdown`);
        return response.data;
    }

    /**
     * 获取当前用户（从 localStorage）
     */
    getCurrentUserFromStorage(): any {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }
}

export const apiClient = new ApiClient();
export default apiClient;
