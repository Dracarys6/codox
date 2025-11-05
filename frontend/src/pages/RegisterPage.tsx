import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { RegisterRequest } from '../types';
import { Layout } from '../components/Layout';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data: RegisterRequest = {
        email,
        password,
        ...(nickname && { nickname }),
      };

      await apiClient.register(data);
      setSuccess(true);

      // 3秒后跳转到登录页
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '注册失败，请检查输入信息');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-green-50 via-emerald-50 to-blue-50 bg-pattern bg-grid relative">
          <div className="max-w-md w-full animate-fade-in relative z-10">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-10 text-center border border-gray-100">
              <h2 className="text-3xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-3">注册成功！</h2>
              <p className="text-base text-gray-600 mb-6">
                正在跳转到登录页面...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full animate-progress shadow-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 bg-pattern bg-grid relative">
        <div className="max-w-md w-full space-y-8 animate-fade-in relative z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-10 space-y-8 border border-gray-100">
            <div className="text-center">
              <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                创建账户
              </h2>
              <p className="mt-3 text-base text-gray-600">
                加入我们，开始您的协作之旅
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
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    邮箱
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white sm:text-sm placeholder:text-gray-400"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      minLength={8}
                      className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white sm:text-sm placeholder:text-gray-400"
                      placeholder="至少8位字符"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">密码长度至少8位</p>
                </div>

                <div>
                  <label htmlFor="nickname" className="block text-sm font-semibold text-gray-700 mb-2">
                    昵称 <span className="text-gray-400 text-xs font-normal">(可选)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="nickname"
                      name="nickname"
                      type="text"
                      className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white sm:text-sm placeholder:text-gray-400"
                      placeholder="你的昵称"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
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
                  {isLoading ? '注册中...' : '创建账户'}
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-sm text-gray-600">
                  已有账户？{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-blue-600 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-2"
                  >
                    立即登录
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

