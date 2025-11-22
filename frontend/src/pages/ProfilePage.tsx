import { FormEvent, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { UpdateProfileRequest } from '../types';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nickname: user?.profile?.nickname || '',
    bio: user?.profile?.bio || '',
    avatar_url: user?.profile?.avatar_url || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.profile?.nickname || '',
        bio: user.profile?.bio || '',
        avatar_url: user.profile?.avatar_url || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updateData: UpdateProfileRequest = {
        nickname: formData.nickname || undefined,
        bio: formData.bio || undefined,
        avatar_url: formData.avatar_url || undefined,
      };

      const updatedUser = await apiClient.updateProfile(updateData);
      updateUser(updatedUser);
      alert('个人信息已更新！');
    } catch (error: any) {
      alert(error.response?.data?.error || '更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData({ ...formData, avatar_url: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="font-inter bg-gray-50 text-dark min-h-screen flex flex-col">
      {/* 导航栏 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/home" className="flex items-center">
                <div className="bg-primary text-white p-1.5 rounded-lg">
                  <i className="fa fa-file-text-o text-xl"></i>
                </div>
                <span className="ml-2 text-xl font-bold">Codox</span>
              </Link>
              <nav className="hidden md:ml-10 md:flex md:space-x-8">
                <Link
                  to="/home"
                  className="text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium"
                >
                  首页
                </Link>
                <Link
                  to="/documents"
                  className="text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium"
                >
                  我的文档
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-grow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">个人资料</h1>
            <p className="text-gray-500">管理您的个人信息和账户设置</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">个人信息</h2>

            {/* 头像上传 */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">头像</label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={formData.avatar_url || user?.profile?.avatar_url || 'https://picsum.photos/id/1005/200/200'}
                    alt="头像"
                    className="h-24 w-24 rounded-full object-cover border-4 border-gray-200"
                  />
                  <label className="absolute bottom-0 right-0 h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition-custom shadow-lg cursor-pointer">
                    <i className="fa fa-camera text-sm"></i>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">支持 JPG、PNG 格式，最大 2MB</p>
                </div>
              </div>
            </div>

            {/* 基本信息表单 */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址
                </label>
                <input
                  type="email"
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-sm text-gray-500">邮箱不可修改</p>
              </div>

              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                  显示名称
                </label>
                <input
                  type="text"
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                  placeholder="请输入您的显示名称"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                  个人简介
                </label>
                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  maxLength={200}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none resize-none"
                  placeholder="介绍一下自己..."
                />
                <p className="mt-1 text-sm text-gray-500">最多 200 字</p>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-custom shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '保存中...' : '保存更改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="bg-primary text-white p-1 rounded-lg">
                <i className="fa fa-file-text-o"></i>
              </div>
              <span className="ml-2 font-bold">Codox</span>
              <p className="ml-4 text-sm text-gray-500">© {new Date().getFullYear()} 保留所有权利</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

