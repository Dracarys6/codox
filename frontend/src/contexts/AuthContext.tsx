import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import apiClient from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初始化时检查是否已登录
    const initAuth = async () => {
      if (apiClient.isAuthenticated()) {
        try {
          // 先尝试从 localStorage 获取用户信息（如果存在）
          const storedUser = apiClient.getCurrentUserFromStorage();
          if (storedUser) {
            setUser(storedUser);
          }

          // 然后从服务器获取最新的用户信息
          const userData = await apiClient.getCurrentUser();
          setUser(userData);
          // 更新 localStorage
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
          // Token 可能已过期，清除认证信息
          apiClient.logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

