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
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <Link
                            to="/"
                            className="flex items-center px-2 py-2 text-2xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 transition-all duration-300"
                        >
                            MultiuserDocument
                        </Link>
                        {user && (
                            <div className="hidden sm:ml-10 sm:flex sm:space-x-1">
                                <Link
                                    to="/"
                                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
                                >
                                    首页
                                </Link>
                                <Link
                                    to="/profile"
                                    className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
                                >
                                    个人资料
                                </Link>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center">
                        {user ? (
                            <div className="flex items-center space-x-4">
                                <div className="hidden md:flex items-center space-x-3 px-5 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200 shadow-sm">
                                    {user.profile.avatar_url ? (
                                        <img
                                            src={user.profile.avatar_url}
                                            alt={user.profile.nickname || user.email}
                                            className="h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-md"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-md ring-2 ring-white">
                                            <span className="text-white text-xs font-bold">
                                                {(user.profile.nickname || user.email)[0].toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <span className="text-sm font-semibold text-gray-800">
                                        {user.profile.nickname || user.email}
                                    </span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                                >
                                    登出
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-4">
                                <Link
                                    to="/login"
                                    className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100"
                                >
                                    登录
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-xl hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                >
                                    注册
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

