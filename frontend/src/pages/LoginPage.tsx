import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiClient.login({
        account: email,
        password: password,
      });

      // 登录成功，更新AuthContext
      login(response.user);
      
      // 跳转到首页
      navigate('/home');
    } catch (error: any) {
      alert(error.response?.data?.error || '登录失败，请检查邮箱和密码');
    } finally {
      setIsLoading(false);
    }
  };

  // 输入框聚焦效果处理函数
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
          {/* 装饰图形 */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-float-delay-1" />

          {/* 品牌Logo和名称 */}
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

          {/* 功能亮点 */}
          <div className="relative z-10 space-y-8">
            <FeatureItem
              icon="fa-users"
              title="实时多人协作"
              description="多人同时编辑同一文档，所有更改实时同步"
            />
            <FeatureItem
              icon="fa-history"
              title="完整历史记录"
              description="追踪所有修改记录，随时回溯到任意版本"
            />
            <FeatureItem
              icon="fa-cloud"
              title="云端自动保存"
              description="所有内容自动保存至云端，永不丢失"
            />
          </div>
        </section>

        {/* 右侧登录表单区 */}
        <main className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md">
            {/* 移动端Logo */}
            <div className="md:hidden flex items-center space-x-3 mb-10">
              <div className="bg-primary text-white p-2 rounded-lg">
                <i className="fa fa-file-text-o text-2xl" />
              </div>
              <h1 className="text-2xl font-bold text-dark">Codox</h1>
            </div>

            {/* 登录表单标题 */}
            <div className="mb-8">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-dark mb-2">
                欢迎回来
              </h2>
              <p className="text-gray-500">请登录您的账号继续使用Codox</p>
            </div>

            {/* 登录表单 */}
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* 邮箱输入 */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="email"
                >
                  邮箱
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fa fa-envelope text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="password"
                  >
                    密码
                  </label>
                  <a
                    href="#"
                    className="text-sm text-primary hover:text-primary/80 transition-custom"
                  >
                    忘记密码?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fa fa-lock text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-custom"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    <i className={`fa ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} />
                  </button>
                </div>
              </div>

              {/* 记住我选项 */}
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded transition-custom"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
                  记住我的登录状态
              </label>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-4 rounded-lg transition-custom focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '登录中...' : '登录'}
              </button>

              {/* 分隔线 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">
                    或使用以下方式登录
                  </span>
                </div>
              </div>

              {/* 第三方登录 */}
              <div className="grid grid-cols-3 gap-3">
                <SocialButton icon="fa-google" label="使用 Google 登录" />
                <SocialButton icon="fa-github" label="使用 GitHub 登录" />
                <SocialButton icon="fa-weixin" label="使用微信登录" />
              </div>
            </form>

            {/* 注册链接 */}
            <div className="mt-8 text-center">
              <p className="text-gray-600">
              还没有账号?{' '}
                <Link
                  to="/register"
                  className="font-medium text-primary hover:text-primary/80 transition-custom"
                >
                立即注册
              </Link>
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* 页脚 */}
      <footer className="py-6 px-8 text-center text-gray-500 text-sm">
        <div className="max-w-6xl mx-auto">
          <p>© {new Date().getFullYear()} Codox. 保留所有权利。</p>
          <div className="flex justify-center space-x-6 mt-3">
            <a href="#" className="hover:text-primary transition-custom">
              隐私政策
            </a>
            <a href="#" className="hover:text-primary transition-custom">
              服务条款
            </a>
            <a href="#" className="hover:text-primary transition-custom">
              帮助中心
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

type FeatureItemProps = {
  icon: string;
  title: string;
  description: string;
};

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <div className="flex items-start space-x-4">
      <div className="bg-white/20 p-3 rounded-lg mt-1">
        <i className={`fa ${icon} text-xl`} />
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-1">{title}</h3>
        <p className="text-white/80">{description}</p>
      </div>
    </div>
  );
}

type SocialButtonProps = {
  icon: string;
  label: string;
};

function SocialButton({ icon, label }: SocialButtonProps) {
  return (
    <button
      type="button"
      className="flex justify-center items-center py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-custom text-gray-700"
      aria-label={label}
    >
      <i className={`fa ${icon} text-lg`} />
    </button>
  );
}


