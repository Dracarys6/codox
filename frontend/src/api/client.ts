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
    PublishVersionRequest,
    PublishVersionResponse,
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

        // 更新 access_token
        localStorage.setItem('access_token', response.data.access_token);

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
    async getDocumentVersions(id: number): Promise<VersionListResponse> {
        const response = await this.client.get<VersionListResponse>(`/docs/${id}/versions`);
        return response.data;
    }

    /**
     * 发布文档版本
     */
    async publishVersion(id: number, data: PublishVersionRequest): Promise<PublishVersionResponse> {
        const response = await this.client.post<PublishVersionResponse>(`/docs/${id}/publish`, data);
        return response.data;
    }

    /**
     * 回滚到指定版本
     */
    async rollbackVersion(docId: number, versionId: number): Promise<{ message: string; version_id: number; doc_id: number }> {
        const response = await this.client.post<{ message: string; version_id: number; doc_id: number }>(
            `/docs/${docId}/rollback/${versionId}`
        );
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

