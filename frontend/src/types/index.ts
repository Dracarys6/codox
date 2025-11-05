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

