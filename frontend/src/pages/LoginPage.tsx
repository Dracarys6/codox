import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { LoginRequest, User } from '../types';
import { Layout } from '../components/Layout';

export function LoginPage() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data: LoginRequest = {
        account,
        password,
      };

      const response = await apiClient.login(data);

      // 更新 AuthContext - 使用完整的用户信息
      const userData: User = {
        id: response.user.id,
        email: response.user.email,
        role: response.user.role,
        profile: {
          nickname: response.user.nickname || '',
          avatar_url: response.user.avatar_url || '',
          bio: '', // 登录响应中可能没有 bio，稍后通过 getCurrentUser 获取完整信息
        },
      };

      // 先设置用户信息，然后获取完整信息
      login(userData);

      // 获取完整的用户信息（包含 profile.bio）
      try {
        const fullUser = await apiClient.getCurrentUser();
        login(fullUser);
      } catch (err) {
        // 如果获取失败，使用登录返回的用户信息
        console.warn('Failed to fetch full user info:', err);
      }

      // 跳转到之前的页面或主页
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);

      // 提取错误信息
      let errorMessage = '登录失败，请检查账号和密码';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.status === 401) {
        errorMessage = '账号或密码错误';
      } else if (err.response?.status === 0 || err.code === 'ERR_NETWORK') {
        errorMessage = '网络错误，请检查后端服务是否运行';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 bg-pattern bg-grid relative">
        <div className="max-w-md w-full space-y-8 animate-fade-in relative z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-10 space-y-8 border border-gray-100">
            <div className="text-center">
              <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                欢迎回来
              </h2>
              <p className="mt-3 text-base text-gray-600">
                登录您的账户以继续
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 p-4 animate-shake">
                  <div className="text-sm font-medium text-red-800">{error}</div>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="account" className="block text-sm font-semibold text-gray-700 mb-2">
                    邮箱或手机号
                  </label>
                  <div className="relative">
                    <input
                      id="account"
                      name="account"
                      type="text"
                      required
                      className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white sm:text-sm placeholder:text-gray-400"
                      placeholder="请输入邮箱或手机号"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                    密码
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white sm:text-sm placeholder:text-gray-400"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-semibold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl"
                >
                  {isLoading ? '登录中...' : '登录'}
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-sm text-gray-600">
                  还没有账户？{' '}
                  <Link
                    to="/register"
                    className="font-semibold text-blue-600 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-2"
                  >
                    立即注册
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}

