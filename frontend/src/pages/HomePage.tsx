import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';

export function HomePage() {
  const { user } = useAuth();

  const completedFeatures = [
    { name: '用户注册和登录' },
    { name: 'JWT Token 认证' },
    { name: '用户资料管理' },
    { name: 'Token 自动刷新' },
    { name: '文档 CRUD 操作' },
    { name: '文档权限管理（ACL）' },
    { name: '文档版本管理' },
  ];

  const inProgressFeatures = [
    { name: '实时协作编辑' },
    { name: '评论和批注' },
    { name: '任务管理' },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 bg-pattern bg-grid relative flex items-center justify-center py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          {/* Hero Section */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-block mb-3">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl mb-2">
                欢迎，{user?.profile.nickname || user?.email}！
              </h1>
            </div>
            <p className="text-base text-gray-600 max-w-xl mx-auto">
              多人在线协作文档系统
            </p>
          </div>


          {/* Features List */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">已完成功能</h2>
              <ul className="space-y-2">
                {completedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center p-2 text-sm text-gray-700">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>{feature.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* In Progress Features */}
          {inProgressFeatures.length > 0 && (
            <div className="max-w-2xl mx-auto mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">开发中功能</h2>
                <ul className="space-y-2">
                  {inProgressFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center p-2 text-sm text-gray-700">
                      <span className="text-amber-500 mr-2">⏳</span>
                      <span>{feature.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

