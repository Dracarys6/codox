import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setResetToken(null);
    setExpiresAt(null);

    try {
      const response = await apiClient.forgotPassword({ email });
      setMessage(response.message || '如果邮箱存在，我们已发送指引');
      if (response.reset_token) {
        setResetToken(response.reset_token);
      }
      if (response.expires_at) {
        setExpiresAt(response.expires_at);
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || '请求失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">找回密码</h1>
          <p className="text-gray-500">输入注册邮箱，我们会生成一个临时重置令牌。</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              注册邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '提交中...' : '发送重置请求'}
          </button>
        </form>

        {message && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
            <p>{message}</p>
            {resetToken && (
              <div className="mt-2">
                <p className="font-semibold text-gray-900">临时重置令牌（开发环境用）</p>
                <code className="block mt-1 break-all text-primary-600 bg-white border border-primary/20 rounded p-2 text-xs">
                  {resetToken}
                </code>
                <p className="text-xs text-gray-500 mt-1">
                  请将该令牌复制到重置页面。{expiresAt ? `有效期至：${expiresAt}` : ''}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="text-center text-sm text-gray-600">
          <Link to="/reset-password" className="text-primary hover:text-primary/80 font-medium">
            已经拿到令牌？前往重置密码
          </Link>
        </div>

        <div className="text-center text-sm text-gray-500">
          <Link to="/login" className="hover:text-primary">
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}


