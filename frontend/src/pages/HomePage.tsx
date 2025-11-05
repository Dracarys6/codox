import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';

export function HomePage() {
  const { user } = useAuth();

  const completedFeatures = [
    { name: '用户注册和登录' },
    { name: 'JWT Token 认证' },
    { name: '用户资料管理' },
    { name: 'Token 自动刷新' },
  ];

  const inProgressFeatures = [
    { name: '文档 CRUD 操作' },
    { name: '文档权限管理（ACL）' },
    { name: '文档版本管理' },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 bg-pattern bg-grid relative flex items-center justify-center py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          {/* Hero Section */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-block mb-3">
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 sm:text-4xl mb-3 animate-gradient">
                欢迎，{user?.profile.nickname || user?.email}！
              </h1>
            </div>
            <p className="mt-3 text-base text-gray-700 max-w-xl mx-auto leading-relaxed">
              多人在线协作文档系统
            </p>
            <p className="mt-1 text-sm text-gray-600 max-w-xl mx-auto">
              让团队协作更高效
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">用户角色</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent capitalize">{user?.role || 'viewer'}</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">已完成功能</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{completedFeatures.length}</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">开发中功能</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">{inProgressFeatures.length}</p>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8 max-w-3xl mx-auto">
            {/* Completed Features */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="mb-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">已完成功能</h2>
                <div className="mt-1 h-1 w-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"></div>
              </div>
              <ul className="space-y-2">
                {completedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-all duration-200 border border-green-100">
                    <span className="text-gray-800 text-sm font-medium">{feature.name}</span>
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* In Progress Features */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="mb-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">开发中功能</h2>
                <div className="mt-1 h-1 w-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"></div>
              </div>
              <ul className="space-y-2">
                {inProgressFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-all duration-200 border border-amber-100">
                    <span className="text-gray-800 text-sm font-medium">{feature.name}</span>
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center animate-pulse">
                      <span className="text-white text-xs font-bold">⏳</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <Link
              to="/profile"
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              管理个人资料
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

