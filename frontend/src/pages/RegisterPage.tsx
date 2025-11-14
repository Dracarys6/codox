import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (password.length < 8) {
      newErrors.password = '密码至少需要8位';
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      newErrors.password = '密码必须包含字母和数字';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.register({
        email,
        password,
        nickname: nickname || undefined,
      });

      alert('注册成功！请登录');
      navigate('/login');
    } catch (error: any) {
      alert(error.response?.data?.error || '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const parent = e.currentTarget.parentElement;
    if (parent) {
      parent.classList.add('scale-[1.02]');
      parent.style.transition = 'transform 0.2s ease';
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parent = e.currentTarget.parentElement;
    if (parent) {
      parent.classList.remove('scale-[1.02]');
    }
  };

  return (
    <div className="font-inter min-h-screen bg-gray-50 text-dark flex flex-col">
      <div className="flex-grow flex flex-col md:flex-row">
        {/* 左侧品牌展示区 */}
        <section className="hidden md:flex md:w-1/2 bg-gradient-primary p-12 flex-col justify-center text-white relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-float-delay-1" />

          <div className="relative z-10 mb-12">
            <div className="flex items-center space-x-3">
              <div className="bg-white text-primary p-2 rounded-lg">
                <i className="fa fa-file-text-o text-2xl" />
              </div>
              <h1 className="text-[clamp(1.8rem,4vw,2.5rem)] font-bold text-shadow">
                Codox
              </h1>
            </div>
            <p className="text-white/80 mt-2 text-lg max-w-md">
              多人实时协作，让文档创作更高效
            </p>
          </div>

          <div className="relative z-10 space-y-8">
            <div className="flex items-start space-x-4">
              <div className="bg-white/20 p-3 rounded-lg mt-1">
                <i className="fa fa-users text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">实时多人协作</h3>
                <p className="text-white/80">多人同时编辑同一文档，所有更改实时同步</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-white/20 p-3 rounded-lg mt-1">
                <i className="fa fa-history text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">完整历史记录</h3>
                <p className="text-white/80">追踪所有修改记录，随时回溯到任意版本</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-white/20 p-3 rounded-lg mt-1">
                <i className="fa fa-cloud text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">云端自动保存</h3>
                <p className="text-white/80">所有内容自动保存至云端，永不丢失</p>
              </div>
            </div>
          </div>
        </section>

        {/* 右侧注册表单区 */}
        <main className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md">
            <div className="md:hidden flex items-center space-x-3 mb-10">
              <div className="bg-primary text-white p-2 rounded-lg">
                <i className="fa fa-file-text-o text-2xl" />
              </div>
              <h1 className="text-2xl font-bold text-dark">Codox</h1>
            </div>

            <div className="mb-8">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-dark mb-2">
                创建账号
              </h2>
              <p className="text-gray-500">注册后即可体验多人实时文档协作</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱 <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fa fa-envelope text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none ${
                      errors.email ? 'border-danger' : 'border-gray-300'
                    }`}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-danger flex items-center">
                    <i className="fa fa-exclamation-circle mr-1"></i>
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                  昵称 (可选)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fa fa-user text-gray-400" />
                  </div>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                    placeholder="请输入您的昵称"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  密码 <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fa fa-lock text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none ${
                      errors.password ? 'border-danger' : 'border-gray-300'
                    }`}
                    placeholder="至少8位，包含字母和数字"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-custom"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    <i className={`fa ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} />
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-danger flex items-center">
                    <i className="fa fa-exclamation-circle mr-1"></i>
                    {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  确认密码 <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fa fa-lock text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none ${
                      errors.confirmPassword ? 'border-danger' : 'border-gray-300'
                    }`}
                    placeholder="再次输入密码"
                    required
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-danger flex items-center">
                    <i className="fa fa-exclamation-circle mr-1"></i>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-lg transition-custom focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '注册中...' : '注册账号'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">或使用以下方式注册</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  className="flex justify-center items-center py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-custom text-gray-700"
                >
                  <i className="fa fa-google text-lg" />
                </button>
                <button
                  type="button"
                  className="flex justify-center items-center py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-custom text-gray-700"
                >
                  <i className="fa fa-github text-lg" />
                </button>
                <button
                  type="button"
                  className="flex justify-center items-center py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-custom text-gray-700"
                >
                  <i className="fa fa-weixin text-lg" />
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                已有账号?{' '}
                <Link to="/login" className="font-medium text-primary hover:text-primary/80 transition-custom">
                  立即登录
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>

      <footer className="py-6 px-8 text-center text-gray-500 text-sm">
        <div className="max-w-6xl mx-auto">
          <p>© {new Date().getFullYear()} Codox. 保留所有权利。</p>
          <div className="flex justify-center space-x-6 mt-3">
            <a href="#" className="hover:text-primary transition-custom">隐私政策</a>
            <a href="#" className="hover:text-primary transition-custom">服务条款</a>
            <a href="#" className="hover:text-primary transition-custom">帮助中心</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

