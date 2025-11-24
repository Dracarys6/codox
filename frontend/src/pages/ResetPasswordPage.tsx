import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const queryToken = searchParams.get('token') || '';
    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (!token) {
      setMessage('请先输入有效的重置令牌');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('两次输入的密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.resetPassword({
        token,
        new_password: password,
      });
      setMessage(response.message || '密码重置成功，请重新登录');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error: any) {
      setMessage(error.response?.data?.error || '重置失败，请确认令牌是否正确');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">重置密码</h1>
          <p className="text-gray-500">粘贴邮件或管理员提供的重置令牌，并设置新密码。</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
              重置令牌
            </label>
            <textarea
              id="token"
              value={token}
              onChange={(event) => setToken(event.target.value.trim())}
              autoComplete="one-time-code"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none h-24"
              placeholder="粘贴 reset token"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              新密码
            </label>
            <input
              id="password"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="至少 8 位，建议包含字母与数字"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              确认新密码
            </label>
            <input
              id="confirmPassword"
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="再次输入新密码"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '提交中...' : '确认重置'}
          </button>
        </form>

        {message && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
            {message}
          </div>
        )}

        <div className="flex justify-between text-sm text-gray-500">
          <Link to="/forgot-password" className="hover:text-primary">
            返回找回步骤
          </Link>
          <Link to="/login" className="hover:text-primary">
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}


