import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="bg-white/90 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center py-4 space-y-3">
                    {/* Logo - 单独一行 */}
                    <div className="w-full text-center">
                        <Link
                            to="/"
                            className="text-xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 transition-all duration-300 inline-block"
                        >
                            MultiuserDocument
                        </Link>
                    </div>

                    {/* 首页 - 单独一行 */}
                    {user && (
                        <div className="w-full text-center">
                            <Link
                                to="/"
                                className="inline-block px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                首页
                            </Link>
                        </div>
                    )}

                    {/* 我的文档 - 单独一行 */}
                    {user && (
                        <div className="w-full text-center">
                            <Link
                                to="/docs"
                                className="inline-block px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                我的文档
                            </Link>
                        </div>
                    )}

                    {/* 个人资料 - 单独一行 */}
                    {user && (
                        <div className="w-full text-center">
                            <Link
                                to="/profile"
                                className="inline-block px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                个人资料
                            </Link>
                        </div>
                    )}

                    {/* 用户信息 - 头像和用户名各占一行 */}
                    {user && (
                        <div className="w-full text-center space-y-2">
                            {/* 头像 - 单独一行 */}
                            <div className="flex justify-center">
                                <img
                                    src={user.profile.avatar_url || 'https://picx.zhimg.com/80/v2-6dab014c0f11d5966dca5827b482afd6_720w.webp?source=1def8aca'}
                                    alt={user.profile.nickname || user.email}
                                    className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://picx.zhimg.com/80/v2-6dab014c0f11d5966dca5827b482afd6_720w.webp?source=1def8aca';
                                    }}
                                />
                            </div>
                            {/* 用户名 - 单独一行 */}
                            <div className="flex justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                    {user.profile.nickname || user.email}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 登出按钮 - 单独一行 */}
                    {user && (
                        <div className="w-full text-center">
                            <button
                                onClick={handleLogout}
                                className="inline-block px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                登出
                            </button>
                        </div>
                    )}

                    {/* 未登录状态 */}
                    {!user && (
                        <>
                            <div className="w-full text-center">
                                <Link
                                    to="/login"
                                    className="inline-block text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100"
                                >
                                    登录
                                </Link>
                            </div>
                            <div className="w-full text-center">
                                <Link
                                    to="/register"
                                    className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-xl hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                >
                                    注册
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}

