import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { UpdateProfileRequest } from '../types';
import { Layout } from '../components/Layout';

export function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setNickname(user.profile.nickname || '');
      setBio(user.profile.bio || '');
      setAvatarUrl(user.profile.avatar_url || '');
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const data: UpdateProfileRequest = {
        nickname: nickname || undefined,
        bio: bio || undefined,
        avatar_url: avatarUrl || undefined,
      };

      const updatedUser = await apiClient.updateProfile(data);
      updateUser(updatedUser);
      setSuccess('资料更新成功！');
    } catch (err: any) {
      setError(err.response?.data?.error || '更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 bg-pattern bg-grid py-8 px-4 sm:px-6 lg:px-8 relative flex items-center justify-center">
        <div className="max-w-2xl mx-auto animate-fade-in relative z-10 w-full">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 px-8 py-10">
              <div className="flex items-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="头像"
                    className="h-20 w-20 rounded-full border-4 border-white shadow-2xl object-cover ring-4 ring-white/20"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white shadow-2xl ring-4 ring-white/20">
                    <div className="h-12 w-12 rounded-full bg-white/30"></div>
                  </div>
                )}
                <div className="ml-5 text-white">
                  <h2 className="text-3xl font-extrabold">{user.profile.nickname || user.email}</h2>
                  <p className="text-blue-100 text-base mt-1.5">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="px-8 py-10">
              {error && (
                <div className="mb-6 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 p-4 animate-shake">
                  <div className="text-sm font-medium text-red-800">{error}</div>
                </div>
              )}

              {success && (
                <div className="mb-6 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 p-4">
                  <div className="text-sm font-medium text-green-800">{success}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      邮箱
                    </label>
                    <input
                      id="email"
                      type="email"
                      disabled
                      className="block w-full rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-500 sm:text-sm py-3.5 px-4 cursor-not-allowed"
                      value={user.email}
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-semibold text-gray-700 mb-2">
                      角色
                    </label>
                    <input
                      id="role"
                      type="text"
                      disabled
                      className="block w-full rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-500 sm:text-sm py-3.5 px-4 cursor-not-allowed capitalize"
                      value={user.role}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="nickname" className="block text-sm font-semibold text-gray-700 mb-2">
                    昵称
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    className="block w-full rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm py-3.5 px-4 transition-all duration-200 placeholder:text-gray-400"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={64}
                    placeholder="请输入昵称"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-semibold text-gray-700 mb-2">
                    个人简介
                  </label>
                  <textarea
                    id="bio"
                    rows={4}
                    className="block w-full rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm py-3.5 px-4 transition-all duration-200 resize-none placeholder:text-gray-400"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="介绍一下你自己..."
                  />
                </div>

                <div>
                  <label htmlFor="avatar_url" className="block text-sm font-semibold text-gray-700 mb-2">
                    头像 URL
                  </label>
                  <input
                    id="avatar_url"
                    type="url"
                    className="block w-full rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm py-3.5 px-4 transition-all duration-200 placeholder:text-gray-400"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  {avatarUrl && (
                    <div className="mt-4 flex items-center space-x-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <img
                        src={avatarUrl}
                        alt="头像预览"
                        className="h-20 w-20 rounded-full object-cover border-2 border-gray-300 shadow-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-sm text-gray-600 font-medium">头像预览</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t-2 border-gray-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-8 py-3.5 border-2 border-gray-300 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
                  >
                    登出
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-8 py-3.5 border border-transparent shadow-lg text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow-xl"
                  >
                    {isLoading ? (
                      '保存中...'
                    ) : (
                      '保存'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

