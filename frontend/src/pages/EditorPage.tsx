import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { Document } from '../types';
import { DocumentEditor } from '../components/DocumentEditor';

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      navigate('/documents');
      return;
    }
    loadDocument(docId);
  }, [docId]);

  const loadDocument = async (currentId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const doc = await apiClient.getDocument(currentId);
      setDocument(doc);
      setTitle(doc.title);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载文档失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleBlur = async () => {
    if (!document || title.trim() === document.title || !docId) return;
    try {
      setIsTitleSaving(true);
      const updated = await apiClient.updateDocument(docId, { title: title.trim() });
      setDocument(updated);
    } catch (err: any) {
      alert(err.response?.data?.error || '更新标题失败，请稍后再试');
      setTitle(document.title);
    } finally {
      setIsTitleSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="fa fa-spinner fa-spin text-4xl text-primary mb-4"></i>
          <p className="text-gray-600">文档加载中，请稍候...</p>
        </div>
      </div>
    );
  }

  if (!docId || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="bg-white shadow-lg rounded-2xl p-8 text-center max-w-md">
          <i className="fa fa-exclamation-circle text-danger text-4xl mb-4"></i>
          <p className="text-gray-700 mb-6">{error || '未找到对应的文档'}</p>
          <button
            onClick={() => navigate('/documents')}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            返回文档列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="font-inter bg-gray-50 text-dark min-h-screen flex flex-col">
      {/* 顶部工具栏 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex justify-between h-16">
            <div className="flex items-center flex-1 min-w-0">
              <Link to="/home" className="flex-shrink-0 flex items-center mr-6">
                <div className="bg-primary text-white p-1.5 rounded-lg">
                  <i className="fa fa-file-text-o text-xl"></i>
                </div>
                <span className="ml-2 text-xl font-bold hidden md:block">Codox</span>
              </Link>

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-2 py-1 w-full max-w-md"
                  placeholder="未命名文档"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500 hidden sm:block">
                {isTitleSaving ? (
                  <div className="flex items-center gap-2 text-warning">
                    <i className="fa fa-spinner fa-spin"></i> 保存标题中...
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-secondary">
                    <i className="fa fa-check-circle"></i> 标题已保存
                  </div>
                )}
              </div>
              <button className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition" title="分享">
                <i className="fa fa-share-alt"></i>
              </button>
              <button className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition" title="更多操作">
                <i className="fa fa-ellipsis-v"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-grow bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
            <section>
              <DocumentEditor
                docId={docId}
                onSave={() => setLastSavedAt(new Date().toLocaleTimeString('zh-CN'))}
              />
            </section>

            {/* 信息侧栏 */}
            <aside className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">文档信息</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>创建时间</span>
                    <span>{new Date(document!.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最后修改</span>
                    <span>{new Date(document!.updated_at).toLocaleString('zh-CN')}</span>
                  </div>
                  {lastSavedAt && (
                    <div className="flex justify-between text-secondary">
                      <span>最近保存</span>
                      <span>{lastSavedAt}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">协作者</h3>
                <div className="flex -space-x-2 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold border-2 border-white">
                    {user?.profile?.nickname?.[0] || '我'}
                  </div>
                  <div className="h-10 w-10 rounded-full bg-secondary text-white flex items-center justify-center text-sm font-semibold border-2 border-white">
                    协
                  </div>
                  <div className="h-10 w-10 rounded-full bg-warning text-white flex items-center justify-center text-sm font-semibold border-2 border-white">
                    作
                  </div>
                  <button className="h-10 w-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-lg border-2 border-white hover:bg-gray-200 transition">
                    +
                  </button>
                </div>
                <button className="text-sm text-primary hover:text-primary/80">邀请协作者</button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">版本历史</h3>
                <div className="space-y-2 text-sm">
                  <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition border border-gray-100">
                    <div className="font-medium text-gray-900">当前版本</div>
                    <div className="text-xs text-gray-500">今天</div>
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition border border-gray-100">
                    <div className="font-medium text-gray-900">版本 2</div>
                    <div className="text-xs text-gray-500">昨天</div>
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg hover:bg灰-50 transition border border-gray-100">
                    <div className="font-medium text-gray-900">版本 1</div>
                    <div className="text-xs text-gray-500">上周</div>
                  </button>
                </div>
                <button className="mt-3 text-sm text-primary hover:text-primary/80">查看全部历史</button>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}