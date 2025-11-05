import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">加载中...</div>
            </div>
        );
    }

    if (!user) {
        // 保存当前路径，登录后可以跳转回来
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}

