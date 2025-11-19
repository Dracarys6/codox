import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { Document, DocumentVersion } from '../types';
import { DocumentEditor } from '../components/DocumentEditor';
import { CommentPanel } from '../components/CommentPanel';
import { TaskPanel } from '../components/TaskPanel';
import { AclManager } from '../components/AclManager';
import { ChatPanel } from '../components/chat/ChatPanel';

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const docId = id ? Number(id) : NaN;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'comments' | 'tasks' | 'acl' | 'chat'>('info');
  const [isSaving, setIsSaving] = useState(false);
  const saveRequestRef = useRef<(() => Promise<void>) | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || isNaN(docId) || docId <= 0) {
      navigate('/documents');
      return;
    }
    loadDocument(docId);
    loadVersions(docId);
  }, [docId, id, navigate]);

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

  const handleSave = async () => {
    if (!docId) return;
    try {
      setIsSaving(true);
      // 触发保存快照
      if (saveRequestRef.current) {
        await saveRequestRef.current();
        setLastSavedAt(new Date().toLocaleTimeString('zh-CN'));
      }
      // 显示保存成功提示
      setTimeout(() => {
        setIsSaving(false);
      }, 1000);
    } catch (err: any) {
      alert(err.response?.data?.error || '保存失败，请稍后再试');
      setIsSaving(false);
    }
  };

  const loadVersions = async (currentId: number) => {
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const response = await apiClient.getDocumentVersions(currentId);
      setVersions(response.versions || []);
    } catch (err: any) {
      setVersionsError(err.response?.data?.error || '加载版本历史失败');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleExit = async () => {
    const confirmed = window.confirm('确定要退出编辑吗？未保存的更改可能会丢失。');
    if (!confirmed) return;

    // 退出前尝试保存
    try {
      if (saveRequestRef.current) {
        setIsSaving(true);
        await saveRequestRef.current();
        setLastSavedAt(new Date().toLocaleTimeString('zh-CN'));
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Failed to save before exit:', err);
      // 即使保存失败也允许退出
    }

    navigate('/documents');
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
                {isTitleSaving || isSaving ? (
                  <div className="flex items-center gap-2 text-warning">
                    <i className="fa fa-spinner fa-spin"></i> 保存中...
                  </div>
                ) : lastSavedAt ? (
                  <div className="flex items-center gap-2 text-secondary">
                    <i className="fa fa-check-circle"></i> 已保存
                  </div>
                ) : null}
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-custom flex items-center gap-2"
                title="保存"
              >
                {isSaving ? (
                  <>
                    <i className="fa fa-spinner fa-spin"></i>
                    <span className="hidden sm:inline">保存中...</span>
                  </>
                ) : (
                  <>
                    <i className="fa fa-save"></i>
                    <span className="hidden sm:inline">保存</span>
                  </>
                )}
              </button>
              <button
                onClick={handleExit}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-custom flex items-center gap-2"
                title="退出"
              >
                <i className="fa fa-sign-out"></i>
                <span className="hidden sm:inline">退出</span>
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
                onSave={() => {
                  setLastSavedAt(new Date().toLocaleTimeString('zh-CN'));
                  setIsSaving(false);
                }}
                onSaveReady={(saveFn) => {
                  // 保存函数准备好时，存储到 ref
                  saveRequestRef.current = saveFn;
                }}
              />
            </section>

            {/* 信息侧栏 */}
            <aside className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 标签页导航 */}
              <div className="border-b border-gray-200 grid grid-cols-2 sm:grid-cols-5">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-3 text-sm font-medium transition-custom ${activeTab === 'info'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <i className="fa fa-info-circle mr-2"></i>信息
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`px-4 py-3 text-sm font-medium transition-custom ${activeTab === 'comments'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <i className="fa fa-comments mr-2"></i>评论
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-4 py-3 text-sm font-medium transition-custom ${activeTab === 'tasks'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <i className="fa fa-tasks mr-2"></i>任务
                </button>
                <button
                  onClick={() => setActiveTab('acl')}
                  className={`px-4 py-3 text-sm font-medium transition-custom ${activeTab === 'acl'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <i className="fa fa-lock mr-2"></i>权限
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-3 text-sm font-medium transition-custom ${activeTab === 'chat'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <i className="fa fa-comments-o mr-2"></i>聊天
                </button>
              </div>

              {/* 标签页内容 */}
              <div className="p-6 max-h-[calc(100vh-300px)] overflow-y-auto">
                {activeTab === 'info' && (
                  <div className="space-y-8">
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
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">版本历史</h3>
                        <button
                          onClick={() => loadVersions(docId)}
                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                          disabled={versionsLoading}
                        >
                          {versionsLoading ? (
                            <>
                              <i className="fa fa-spinner fa-spin"></i>
                              刷新中
                            </>
                          ) : (
                            <>
                              <i className="fa fa-refresh"></i>
                              刷新
                            </>
                          )}
                        </button>
                      </div>

                      {versionsError && (
                        <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          {versionsError}
                        </div>
                      )}

                      {versionsLoading && versions.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                          <i className="fa fa-spinner fa-spin"></i>
                          正在加载版本历史...
                        </div>
                      ) : versions.length > 0 ? (
                        <div className="space-y-2 text-sm">
                          {versions.slice(0, 3).map((version, index) => (
                            <button
                              key={version.id}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition border border-gray-100 flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between text-gray-900 font-medium">
                                <span>{index === 0 ? '最新版本' : `版本 #${version.id}`}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(version.created_at).toLocaleDateString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center text-xs text-gray-500 gap-2 flex-wrap">
                                <span>
                                  <i className="fa fa-user mr-1"></i>
                                  创建者 ID: {version.created_by ?? '未知'}
                                </span>
                                <span>
                                  <i className="fa fa-database mr-1"></i>
                                  {version.size_bytes
                                    ? `${(version.size_bytes / 1024).toFixed(1)} KB`
                                    : '大小未知'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-4">
                          暂无发布版本，保存或发布后可在此查看历史。
                        </div>
                      )}

                      {versions.length > 3 && (
                        <p className="mt-3 text-xs text-gray-400">
                          显示最近 3 个版本，其余版本请前往版本管理查看。
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'comments' && <CommentPanel docId={docId} />}

                {activeTab === 'tasks' && <TaskPanel docId={docId} />}

                {activeTab === 'acl' && (
                  <div className="max-h-[calc(100vh-360px)] overflow-y-auto pr-1 -mr-1">
                    <AclManager
                      docId={docId}
                      onUpdate={() => loadDocument(docId)}
                    />
                  </div>
                )}

                {activeTab === 'chat' && (
                  <div className="max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                    <ChatPanel docId={docId} />
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}