import axios, { AxiosError, AxiosInstance } from 'axios';
import {
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    User,
    UpdateProfileRequest,
    Document,
    CreateDocumentRequest,
    UpdateDocumentRequest,
    DocumentListResponse,
    DocumentListParams,
    DocumentAcl,
    UpdateAclRequest,
    VersionListResponse,
    VersionListParams,
    DocumentVersion,
    PublishVersionRequest,
    PublishVersionResponse,
    CreateVersionRequest,
    CreateVersionResponse,
    RestoreVersionResponse,
    VersionDiffResponse,
    ChatRoom,
    ChatRoomListParams,
    ChatRoomListResponse,
    CreateChatRoomRequest,
    ChatMessageListResponse,
    SendChatMessageRequest,
    ChatMessage,
    NotificationListResponse,
    NotificationFilterParams,
} from '../types';

// 开发环境：使用相对路径利用 Vite 代理
// 生产环境：使用环境变量配置的完整 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
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
            }
        );

        // 响应拦截器：处理 Token 刷新
        this.client.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
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
            }
        );
    }

    // 清除认证信息
    private clearAuth() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('chat_token');
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
        const chatToken = response.data.chat_token || response.data.access_token;
        localStorage.setItem('chat_token', chatToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        return response.data;
    }

    /**
     * 刷新 Token
     */
    async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
        const response = await this.client.post<RefreshTokenResponse>('/auth/refresh', data);

        // 更新 access_token / chat_token
        localStorage.setItem('access_token', response.data.access_token);
        const chatToken = response.data.chat_token || response.data.access_token;
        localStorage.setItem('chat_token', chatToken);

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
            const updatedUser = { ...user, ...response.data };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        return response.data;
    }

    /**
     * 搜索用户
     */
    async searchUsers(query: string, params?: { page?: number; page_size?: number }): Promise<{ users: User[]; total: number; page: number; page_size: number }> {
        const response = await this.client.get<{ users: User[]; total: number; page: number; page_size: number }>('/users/search', {
            params: { q: query, ...params },
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
        const response = await this.client.get<DocumentListResponse>('/docs', { params });
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
     * 更新文档
     */
    async updateDocument(id: number, data: UpdateDocumentRequest): Promise<Document> {
        const response = await this.client.patch<Document>(`/docs/${id}`, data);
        return response.data;
    }

    /**
     * 删除文档
     */
    async deleteDocument(id: number): Promise<{ message: string; id: number }> {
        const response = await this.client.delete<{ message: string; id: number }>(`/docs/${id}`);
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
        const response = await this.client.get<VersionListResponse>(`/docs/${id}/versions`, { params });
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
        const response = await this.client.post<RestoreVersionResponse>(
            `/docs/${docId}/versions/${versionId}/restore`
        );
        return response.data;
    }

    /**
     * 获取版本差异
     */
    async getVersionDiff(docId: number, versionId: number, baseVersionId?: number): Promise<VersionDiffResponse> {
        const params = baseVersionId ? { base_version_id: baseVersionId } : {};
        const response = await this.client.get<VersionDiffResponse>(
            `/docs/${docId}/versions/${versionId}/diff`,
            { params }
        );
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
    async rollbackVersion(docId: number, versionId: number): Promise<{ message: string; version_id: number; doc_id: number }> {
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
    async getCollaborationToken(docId: number): Promise<{ token: string; expiresIn: number }> {
        const response = await this.client.post<{ token: string; expiresIn: number }>('/collab/token', {
            doc_id: docId,
        });
        return response.data;
    }

    /**
     * 获取引导快照
     */
    async getBootstrap(docId: number): Promise<{ snapshot_url: string | null; sha256: string | null; version_id: number | null }> {
        const response = await this.client.get<{ snapshot_url: string | null; sha256: string | null; version_id: number | null }>(
            `/collab/bootstrap/${docId}`
        );
        return response.data;
    }

    /**
     * 下载快照文件（通过后端代理）
     */
    async downloadSnapshot(docId: number): Promise<ArrayBuffer> {
        const response = await this.client.get(
            `/collab/snapshot/${docId}/download`,
            { 
                responseType: 'arraybuffer',
                headers: {
                    'Accept': 'application/octet-stream'
                }
            }
        );
        return response.data as ArrayBuffer;
    }

    /**
     * 上传快照文件到 MinIO
     */
    async uploadSnapshot(docId: number, data: { data: string; filename?: string }): Promise<{ snapshot_url: string; message: string }> {
        const response = await this.client.post<{ snapshot_url: string; message: string }>(
            `/collab/upload/${docId}`,
            data
        );
        return response.data;
    }

    /**
     * 保存快照元数据（使用 JWT 认证）
     */
    async saveSnapshot(docId: number, data: { snapshot_url: string; sha256: string; size_bytes: number }): Promise<{ version_id: number; message: string }> {
        const response = await this.client.post<{ version_id: number; message: string }>(
            `/collab/snapshot/${docId}/save`,
            data
        );
        return response.data;
    }

    // ========== 评论相关 API ==========

    /**
     * 获取文档评论列表
     */
    async getComments(docId: number): Promise<{ comments: any[] }> {
        const response = await this.client.get<{ comments: any[] }>(`/docs/${docId}/comments`);
        return response.data;
    }

    /**
     * 创建评论
     */
    async createComment(docId: number, data: { content: string; anchor?: any; parent_id?: number }): Promise<any> {
        const response = await this.client.post<any>(`/docs/${docId}/comments`, data);
        return response.data;
    }

    /**
     * 删除评论
     */
    async deleteComment(commentId: number): Promise<{ message: string }> {
        const response = await this.client.delete<{ message: string }>(`/comments/${commentId}`);
        return response.data;
    }

    // ========== 任务相关 API ==========

    /**
     * 获取文档任务列表
     */
    async getTasks(docId: number): Promise<{ tasks: any[] }> {
        const response = await this.client.get<{ tasks: any[] }>(`/docs/${docId}/tasks`);
        return response.data;
    }

    /**
     * 创建任务
     */
    async createTask(docId: number, data: { title: string; assignee_id?: number; due_at?: string }): Promise<any> {
        const response = await this.client.post<any>(`/docs/${docId}/tasks`, data);
        return response.data;
    }

    /**
     * 更新任务
     */
    async updateTask(taskId: number, data: { status?: string; title?: string; assignee_id?: number; due_at?: string }): Promise<any> {
        const response = await this.client.patch<any>(`/tasks/${taskId}`, data);
        return response.data;
    }

    /**
     * 删除任务
     */
    async deleteTask(taskId: number): Promise<{ message: string }> {
        const response = await this.client.delete<{ message: string }>(`/tasks/${taskId}`);
        return response.data;
    }

    // ========== 通知相关 API ==========

    /**
     * 获取通知列表
     */
    async getNotifications(params?: NotificationFilterParams): Promise<NotificationListResponse> {
        const response = await this.client.get<NotificationListResponse>('/notifications', { params });
        return response.data;
    }

    /**
     * 标记通知为已读
     */
    async markNotificationsAsRead(notificationIds: number[]): Promise<{ message: string }> {
        const response = await this.client.post<{ message: string }>('/notifications/read', {
            notification_ids: notificationIds,
        });
        return response.data;
    }

    /**
     * 获取未读通知数量
     */
    async getUnreadNotificationCount(): Promise<{ unread_count: number }> {
        const response = await this.client.get<{ unread_count: number }>('/notifications/unread-count');
        return response.data;
    }

    // ========== 搜索相关 API ==========

    /**
     * 搜索文档
     */
    async searchDocuments(query: string, params?: { page?: number; page_size?: number }): Promise<{ hits: any[]; total: number }> {
        const response = await this.client.get<{ hits: any[]; total: number }>('/search', {
            params: { q: query, ...params },
        });
        return response.data;
    }

    // ========== 聊天相关 API ==========

    /**
     * 获取聊天室列表
     */
    async getChatRooms(params?: ChatRoomListParams): Promise<ChatRoomListResponse> {
        const response = await this.client.get<ChatRoomListResponse>('/chat/rooms', { params });
        return response.data;
    }

    /**
     * 创建聊天室
     */
    async createChatRoom(data: CreateChatRoomRequest): Promise<ChatRoom> {
        const response = await this.client.post<ChatRoom>('/chat/rooms', data);
        return response.data;
    }

    /**
     * 添加聊天室成员
     */
    async addChatRoomMembers(roomId: number, userIds: number[]): Promise<{ message: string }> {
        const response = await this.client.post<{ message: string }>(`/chat/rooms/${roomId}/members`, {
            user_ids: userIds,
        });
        return response.data;
    }

    /**
     * 获取聊天室消息
     */
    async getChatMessages(
        roomId: number,
        params?: { page?: number; page_size?: number; before_id?: number }
    ): Promise<ChatMessageListResponse> {
        const response = await this.client.get<ChatMessageListResponse>(`/chat/rooms/${roomId}/messages`, {
            params,
        });
        return response.data;
    }

    /**
     * 发送聊天消息
     */
    async sendChatMessage(roomId: number, data: SendChatMessageRequest): Promise<ChatMessage> {
        const response = await this.client.post<ChatMessage>(`/chat/rooms/${roomId}/messages`, data);
        return response.data;
    }

    /**
     * 标记消息为已读
     */
    async markChatMessageRead(messageId: number): Promise<{ message: string }> {
        const response = await this.client.post<{ message: string }>(`/chat/messages/${messageId}/read`, {});
        return response.data;
    }

    /**
     * 上传聊天文件
     */
    async uploadChatFile(roomId: number, formData: FormData): Promise<ChatMessage> {
        const response = await this.client.post<ChatMessage>(
            `/chat/rooms/${roomId}/files`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    }

    /**
     * 下载聊天文件
     */
    async downloadChatFile(messageId: number): Promise<Blob> {
        const response = await this.client.get(`/chat/messages/${messageId}/file`, {
            responseType: 'blob',
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

