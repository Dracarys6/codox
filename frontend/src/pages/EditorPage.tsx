import { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { Document, DocumentVersion, AclEntry, DocumentAcl } from '../types';
import { DocumentEditor } from '../components/DocumentEditor';
import { CommentPanel } from '../components/CommentPanel';
import { TaskPanel } from '../components/TaskPanel';
import { AclManager } from '../components/AclManager';
import { ChatPanel } from '../components/chat/ChatPanel';

type SideTabKey = 'info' | 'comments' | 'tasks' | 'acl' | 'chat';

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
  const [activeTab, setActiveTab] = useState<SideTabKey>('info');
  const [isSaving, setIsSaving] = useState(false);
  const saveRequestRef = useRef<(() => Promise<void>) | null>(null);
  const [aclEntries, setAclEntries] = useState<AclEntry[]>([]);
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
    setAclEntries([]);
  }, [docId, id, navigate]);
  const handleAclLoaded = (data: DocumentAcl | null) => {
    setAclEntries(data?.acl || []);
  };

  const isOwner = useMemo(() => {
    if (!document || !user) return false;
    return document.owner_id === user.id;
  }, [document, user]);

  const roleStats = useMemo(() => {
    return aclEntries.reduce(
      (stats, entry) => {
        stats.total += 1;
        stats[entry.permission] = (stats[entry.permission] || 0) + 1;
        return stats;
      },
      { total: 0, owner: 0, editor: 0, viewer: 0 } as Record<'total' | 'owner' | 'editor' | 'viewer', number>
    );
  }, [aclEntries]);

  const sortedCollaborators = useMemo(() => {
    const ownerEntry = aclEntries.find((entry) => entry.permission === 'owner');
    const others = aclEntries.filter((entry) => entry.permission !== 'owner');
    return ownerEntry ? [ownerEntry, ...others] : others;
  }, [aclEntries]);

  const collaboratorBadges = useMemo(() => {
    const visible = sortedCollaborators.slice(0, 3);
    const extra = Math.max(sortedCollaborators.length - visible.length, 0);
    return { visible, extra };
  }, [sortedCollaborators]);

  const formatCollaboratorName = (entry: AclEntry) => entry.nickname || entry.email || `用户 ${entry.user_id}`;
  const getCollaboratorInitials = (entry: AclEntry) => {
    const source = entry.nickname || entry.email || String(entry.user_id);
    return source?.slice(0, 2).toUpperCase();
  };

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
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_350px] gap-6 items-start">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-h-[calc(100vh-260px)]">
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
              <div className="border-b border-gray-200 flex flex-wrap">
                {([
                  { key: 'info', label: '信息', icon: 'fa fa-info-circle' },
                  { key: 'comments', label: '评论', icon: 'fa fa-comments' },
                  { key: 'tasks', label: '任务', icon: 'fa fa-tasks' },
                  { key: 'acl', label: '权限', icon: 'fa fa-lock' },
                  { key: 'chat', label: '聊天', icon: 'fa fa-comments-o' },
                ] as { key: SideTabKey; label: string; icon: string }[]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 min-w-[140px] text-center px-4 py-3 text-sm font-medium transition-custom ${activeTab === tab.key
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <i className={`${tab.icon} mr-2`}></i>
                    {tab.label}
                  </button>
                ))}
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
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">协作者</h3>
                        <button
                          onClick={() => setActiveTab('acl')}
                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <i className="fa fa-lock"></i>
                          管理权限
                        </button>
                      </div>
                      {aclEntries.length > 0 ? (
                        <>
                          <div className="flex -space-x-2 mb-3">
                            {collaboratorBadges.visible.map((entry) => (
                              <div
                                key={`collab-${entry.user_id}-${entry.permission}`}
                                className="h-10 w-10 rounded-full bg-primary/90 text-white flex items-center justify-center text-xs font-semibold border-2 border-white"
                                title={`${formatCollaboratorName(entry)}（${entry.permission === 'owner' ? '所有者' : entry.permission === 'editor' ? '编辑者' : '查看者'}）`}
                              >
                                {getCollaboratorInitials(entry)}
                              </div>
                            ))}
                            {collaboratorBadges.extra > 0 && (
                              <div className="h-10 w-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-semibold border-2 border-white">
                                +{collaboratorBadges.extra}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                            <span className="px-2 py-1 rounded-lg bg-gray-100 text-center">
                              所有者 {roleStats.owner}
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-center">
                              编辑者 {roleStats.editor}
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-600 text-center">
                              查看者 {roleStats.viewer}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-4">
                          暂无协作者，点击“管理权限”可以邀请团队成员。
                        </div>
                      )}
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
                  <div className="max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                    <AclManager
                      docId={docId}
                      onUpdate={() => loadDocument(docId)}
                      onLoaded={handleAclLoaded}
                      isOwner={isOwner}
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