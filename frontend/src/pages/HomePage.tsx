import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { Document } from '../types';
import { NotificationBell } from '../components/NotificationBell';
import { getDocumentStatusDisplay } from '../utils/documentStatus';
import { ImportModal } from '../components/ImportModal';
import { ExportMenu } from '../components/ExportMenu';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

interface DocumentStats {
  collaborativeCount: number;
  attentionNeededCount: number;
  collaborativeDocs: Document[];
  attentionNeededDocs: Document[];
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAlertVisible, setIsAlertVisible] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [stats, setStats] = useState<DocumentStats>({ 
    collaborativeCount: 0, 
    attentionNeededCount: 0,
    collaborativeDocs: [],
    attentionNeededDocs: []
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (documents.length > 0 && user?.id) {
      loadStats();
    }
  }, [documents, user?.id]);

  const loadDocuments = async () => {
    try {
      // 加载更多文档以获取完整的统计信息（最多100个）
      const response = await apiClient.getDocumentList({ page: 1, pageSize: 100 });
      const sortedDocs = [...response.docs].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setDocuments(sortedDocs);
      setTotalDocs(response.total);
    } catch (error) {
      console.error('加载文档失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;
    
    setIsLoadingStats(true);
    try {
      // 获取所有文档的 ACL 信息，统计协作文档
      // 注意：只有文档 owner 才能查看 ACL
      const aclPromises = documents.map((doc) => 
        apiClient.getDocumentAcl(doc.id).catch((err: any) => {
          // 如果是权限错误（403），说明用户不是 owner
          // 但用户能访问这个文档（在列表中），说明文档有 ACL 权限，可能是协作文档
          // 返回一个标记对象表示用户不是 owner 但能访问
          if (err.response?.status === 403) {
            return { isCollaborative: true }; // 用户不是 owner 但能访问，说明是协作文档
          }
          return null;
        })
      );
      const aclResults = await Promise.all(aclPromises);
      
      // 协作文档统计：
      // 1. 用户是 owner 且 ACL 中有多个用户的文档
      // 2. 用户不是 owner 但能访问的文档（说明有 ACL 权限，是协作文档）
      const collaborativeDocs: Document[] = [];
      aclResults.forEach((acl, index) => {
        if (!acl) return;
        
        const doc = documents[index];
        if (!doc) return;
        
        // 如果返回的是标记对象，说明用户不是 owner 但能访问，是协作文档
        if ('isCollaborative' in acl && acl.isCollaborative) {
          collaborativeDocs.push(doc);
        }
        // 如果返回的是 ACL 数据，检查是否有多个用户
        else if (acl.acl && acl.acl.length > 1) {
          collaborativeDocs.push(doc);
        }
      });

      // 获取所有文档的任务，统计需要关注的文档
      const taskPromises = documents.map((doc) =>
        apiClient.getTasks(doc.id).catch(() => ({ tasks: [] }))
      );
      const taskResults = await Promise.all(taskPromises);
      
      // 需要关注：有未完成任务（todo 或 doing）的文档
      // 特别是分配给当前用户的任务，或者是当前用户创建的未完成任务
      const attentionNeededDocs: Document[] = [];
      const attentionDocIds = new Set<number>();
      
      taskResults.forEach((result, index) => {
        if (result && result.tasks && Array.isArray(result.tasks)) {
          const hasUnfinishedTask = result.tasks.some((task: any) => {
            const isUnfinished = task.status === 'todo' || task.status === 'doing';
            const isAssignedToMe = task.assignee_id === user.id;
            const isMyTask = task.created_by === user.id;
            // 如果有未完成的任务，且是指派给当前用户或当前用户创建的
            return isUnfinished && (isAssignedToMe || isMyTask);
          });
          
          if (hasUnfinishedTask) {
            const doc = documents[index];
            if (doc && !attentionDocIds.has(doc.id)) {
              attentionDocIds.add(doc.id);
              attentionNeededDocs.push(doc);
            }
          }
        }
      });

      setStats({
        collaborativeCount: collaborativeDocs.length,
        attentionNeededCount: attentionNeededDocs.length,
        collaborativeDocs,
        attentionNeededDocs,
      });
    } catch (error) {
      console.error('加载统计信息失败:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const overdueDocs = useMemo(() => {
    const now = Date.now();
    return documents.filter((doc) => now - new Date(doc.updated_at).getTime() > THIRTY_DAYS);
  }, [documents]);

  const continueDoc = documents[0];
  
  // 最近文档只显示前10个
  const recentDocs = useMemo(() => documents.slice(0, 10), [documents]);

  const handleCreateDocument = async () => {
    try {
      const newDoc = await apiClient.createDocument({
        title: '未命名文档',
      });
      navigate(`/editor/${newDoc.id}`);
    } catch (error) {
      alert('创建文档失败');
    }
  };

  const handleDeleteDocument = async (docId: number, docTitle: string) => {
    if (!window.confirm(`确定要删除文档"${docTitle}"吗？此操作无法撤销。`)) {
      return;
    }

    try {
      await apiClient.deleteDocument(docId);
      // 重新加载文档列表
      loadDocuments();
    } catch (error: any) {
      alert(error.response?.data?.error || '删除文档失败，请稍后重试');
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  return (
    <div className="font-inter bg-gray-50 text-dark min-h-screen flex flex-col">
      {/* 导航栏 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
              <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/home" className="flex items-center">
                  <div className="bg-primary text-white p-1.5 rounded-lg">
                    <i className="fa fa-file-text-o text-xl"></i>
                  </div>
                  <span className="ml-2 text-xl font-bold">Codox</span>
                </Link>
              </div>
              <nav className="hidden md:ml-10 md:flex md:space-x-8">
                <Link
                  to="/home"
                  className="text-primary border-primary inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  首页
                </Link>
                <Link
                  to="/documents"
                  className="text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium"
                >
                  我的文档
                </Link>
                <Link
                  to="/notifications"
                  className="text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium"
                >
                  通知
                </Link>
              </nav>
            </div>

            <div className="flex items-center">
              <Link
                to="/search"
                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 mr-2"
                title="搜索"
              >
                <i className="fa fa-search"></i>
              </Link>

              <NotificationBell />

              <div className="ml-3 relative">
                <Link
                  to="/profile"
                  className="flex items-center max-w-xs rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <img
                    className="h-8 w-8 rounded-full object-cover"
                    src={user?.profile?.avatar_url || 'https://picsum.photos/id/1005/200/200'}
                    alt="用户头像"
                  />
                  <span className="ml-2 hidden md:block">{user?.profile?.nickname || user?.email}</span>
                  <i className="fa fa-chevron-down ml-1 text-xs"></i>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-grow">
        {/* 欢迎区域 */}
        <section className="bg-gradient-primary text-white py-12 md:py-20 relative overflow-hidden">
          <div className="absolute -top-16 left-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="md:w-3/5">
              <h1 className="text-[clamp(1.8rem,4vw,3rem)] font-bold text-shadow mb-4">
                欢迎回来，{user?.profile?.nickname || user?.email}
              </h1>
              <p className="text-white/90 text-lg md:text-xl mb-8 max-w-2xl">
                {continueDoc
                  ? `继续您的文档创作之旅。最近编辑的《${continueDoc.title}》有新的协作动态。`
                  : '创建您的第一个文档开始协作之旅。'}
              </p>
              <div className="flex flex-wrap gap-4">
                {continueDoc && (
                  <Link
                    to={`/editor/${continueDoc.id}`}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-primary bg-white hover:bg-gray-100 transition-all transform hover:scale-105"
                  >
                    继续编辑文档
                    <i className="fa fa-arrow-right ml-2"></i>
                  </Link>
                )}
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center px-6 py-3 border border-white/30 text-base font-medium rounded-lg shadow-lg bg-white/10 hover:bg-white/20 transition-all transform hover:scale-105 backdrop-blur-sm"
                >
                  <i className="fa fa-upload mr-2"></i>
                  导入文档
                </button>
                <button
                  onClick={handleCreateDocument}
                  className="inline-flex items-center px-6 py-3 border border-white/30 text-base font-medium rounded-lg shadow-lg bg-white/10 hover:bg-white/20 transition-all transform hover:scale-105 backdrop-blur-sm"
                >
                  <i className="fa fa-plus mr-2"></i>
                  创建新文档
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 状态提醒 */}
        {isAlertVisible && overdueDocs.length > 0 && (
          <section className="bg-warning/10 border-l-4 border-warning py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-start gap-4">
              <i className="fa fa-exclamation-triangle text-warning text-xl mt-1" />
              <div className="flex-1">
                <p className="text-sm text-warning-800">
                  <span className="font-medium">注意：</span> 有 {overdueDocs.length} 个文档超过 30 天未更新，可能需要检查内容时效性。
                  <Link to="/documents" className="text-primary hover:underline ml-2">
                    查看详情
                  </Link>
                </p>
              </div>
              <button
                type="button"
                className="text-warning-500 hover:text-warning-800"
                onClick={() => setIsAlertVisible(false)}
                aria-label="关闭提醒"
              >
                <i className="fa fa-times" />
              </button>
            </div>
          </section>
        )}

        {/* 功能导航与文档区域 */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <Link
              to="/documents"
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <i className="fa fa-files-o text-xl" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">文档总数</p>
                <p className="text-2xl font-semibold text-gray-900">{totalDocs}</p>
              </div>
              <i className="fa fa-chevron-right text-gray-400"></i>
            </Link>
            <div
              className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 transition-all ${
                stats.collaborativeDocs.length > 0
                  ? 'hover:shadow-md hover:border-secondary/30 cursor-pointer'
                  : ''
              }`}
              onClick={() => {
                if (stats.collaborativeDocs.length > 0) {
                  // 滚动到协作文档列表
                  const element = document.getElementById('collaborative-docs');
                  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                <i className="fa fa-users text-xl" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">协作文档</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoadingStats ? (
                    <i className="fa fa-spinner fa-spin text-lg"></i>
                  ) : (
                    stats.collaborativeCount
                  )}
                </p>
              </div>
              {stats.collaborativeDocs.length > 0 && (
                <i className="fa fa-chevron-right text-gray-400"></i>
              )}
            </div>
            <div
              className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 transition-all ${
                stats.attentionNeededDocs.length > 0
                  ? 'hover:shadow-md hover:border-warning/30 cursor-pointer'
                  : ''
              }`}
              onClick={() => {
                if (stats.attentionNeededDocs.length > 0) {
                  // 滚动到需要关注的文档列表
                  const element = document.getElementById('attention-needed-docs');
                  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                <i className="fa fa-exclamation-circle text-xl" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">需要关注</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoadingStats ? (
                    <i className="fa fa-spinner fa-spin text-lg"></i>
                  ) : (
                    stats.attentionNeededCount
                  )}
                </p>
              </div>
              {stats.attentionNeededDocs.length > 0 && (
                <i className="fa fa-chevron-right text-gray-400"></i>
              )}
            </div>
          </div>

          {/* 协作文档列表 */}
          <div id="collaborative-docs" className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <i className="fa fa-users text-secondary"></i>
                协作文档
              </h2>
              <span className="text-sm text-gray-500">
                {isLoadingStats ? (
                  <i className="fa fa-spinner fa-spin"></i>
                ) : (
                  `${stats.collaborativeCount} 个文档`
                )}
              </span>
            </div>
            {isLoadingStats ? (
              <div className="bg-white shadow-sm rounded-xl p-8 text-center border border-gray-100">
                <i className="fa fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
                <p className="text-sm text-gray-500">加载中...</p>
              </div>
            ) : stats.collaborativeDocs.length > 0 ? (
              <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
                <div className="divide-y divide-gray-200">
                  {stats.collaborativeDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      to={`/editor/${doc.id}`}
                      className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex-shrink-0 h-10 w-10 bg-secondary/10 rounded-md flex items-center justify-center">
                            <i className="fa fa-file-text-o text-secondary"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{doc.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              最后编辑：{formatDate(doc.updated_at)}
                            </div>
                          </div>
                        </div>
                        <i className="fa fa-chevron-right text-gray-400 ml-4"></i>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-xl p-8 text-center border border-gray-100">
                <i className="fa fa-users text-4xl text-gray-300 mb-3"></i>
                <p className="text-sm text-gray-500">暂无协作文档</p>
              </div>
            )}
          </div>

          {/* 需要关注的文档列表 */}
          <div id="attention-needed-docs" className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <i className="fa fa-exclamation-circle text-warning"></i>
                需要关注
              </h2>
              <span className="text-sm text-gray-500">
                {isLoadingStats ? (
                  <i className="fa fa-spinner fa-spin"></i>
                ) : (
                  `${stats.attentionNeededCount} 个文档`
                )}
              </span>
            </div>
            {isLoadingStats ? (
              <div className="bg-white shadow-sm rounded-xl p-8 text-center border border-gray-100">
                <i className="fa fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
                <p className="text-sm text-gray-500">加载中...</p>
              </div>
            ) : stats.attentionNeededDocs.length > 0 ? (
              <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
                <div className="divide-y divide-gray-200">
                  {stats.attentionNeededDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      to={`/editor/${doc.id}`}
                      className="block px-6 py-4 hover:bg-warning/5 transition-colors border-l-4 border-warning/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex-shrink-0 h-10 w-10 bg-warning/10 rounded-md flex items-center justify-center">
                            <i className="fa fa-exclamation-circle text-warning"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{doc.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              最后编辑：{formatDate(doc.updated_at)}
                            </div>
                          </div>
                        </div>
                        <i className="fa fa-chevron-right text-gray-400 ml-4"></i>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-xl p-8 text-center border border-gray-100">
                <i className="fa fa-check-circle text-4xl text-gray-300 mb-3"></i>
                <p className="text-sm text-gray-500">暂无需要关注的文档</p>
              </div>
            )}
          </div>

          {/* 快速功能导航 */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">快速操作</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            <button
              onClick={handleCreateDocument}
              className="bg-white rounded-xl shadow-sm p-5 flex flex-col items-center text-center card-hover border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center mb-3 shadow-sm">
                <i className="fa fa-file-text-o text-primary text-xl"></i>
              </div>
              <h3 className="font-medium text-gray-900">新建文档</h3>
              <p className="text-sm text-gray-500 mt-1">从头开始创作</p>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="bg-white rounded-xl shadow-sm p-5 flex flex-col items-center text-center card-hover border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mb-3 shadow-sm">
                <i className="fa fa-upload text-purple-600 text-xl"></i>
              </div>
              <h3 className="font-medium text-gray-900">导入文档</h3>
              <p className="text-sm text-gray-500 mt-1">支持 Word/PDF/Markdown</p>
            </button>

            <Link
              to="/search"
              className="bg-white rounded-xl shadow-sm p-5 flex flex-col items-center text-center card-hover border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mb-3 shadow-sm">
                <i className="fa fa-search text-blue-600 text-xl"></i>
              </div>
              <h3 className="font-medium text-gray-900">搜索文档</h3>
              <p className="text-sm text-gray-500 mt-1">快速查找文档内容</p>
            </Link>
          </div>

          {/* 最近文档 */}
          <div className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">最近文档</h2>
              <Link
                to="/documents"
                className="text-primary hover:text-primary/80 text-sm font-medium flex items-center"
              >
                查看全部
                <i className="fa fa-angle-right ml-1"></i>
              </Link>
            </div>

            {isLoading ? (
              <div className="bg-white shadow-sm rounded-xl p-12 text-center">
                <i className="fa fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="bg-white shadow-sm rounded-xl p-12 text-center">
                <i className="fa fa-file-text-o text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-medium text-gray-900 mb-2">暂无文档</h3>
                <p className="text-gray-500 mb-6">创建您的第一个文档开始协作之旅</p>
                <button
                  onClick={handleCreateDocument}
                  className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-custom"
                >
                  <i className="fa fa-plus mr-2"></i>新建文档
                </button>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        文档名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        最后编辑
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-9 w-9 bg-blue-100 rounded-md flex items-center justify-center text-primary">
                              <i className="fa fa-file-text-o"></i>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                              <div className="text-sm text-gray-500">
                                {Array.isArray(doc.tags) && doc.tags.length > 0
                                  ? doc.tags.map((t) => (typeof t === 'string' ? t : t.name)).join(', ')
                                  : '未分类'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{formatDate(doc.updated_at)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const statusDisplay = getDocumentStatusDisplay(doc.status, doc.is_locked);
                            return (
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusDisplay.className}`}>
                                {statusDisplay.text}
                          </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <ExportMenu docId={doc.id} docTitle={doc.title} variant="dropdown" />
                            <Link
                              to={`/editor/${doc.id}`}
                              className="text-primary hover:text-primary/80"
                            >
                              编辑
                            </Link>
                            <button
                              onClick={() => handleDeleteDocument(doc.id, doc.title)}
                              className="text-danger hover:text-danger/80 transition-custom"
                              title="删除文档"
                            >
                              <i className="fa fa-trash-o mr-1"></i>删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
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
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <i className="fa fa-twitter"></i>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <i className="fa fa-github"></i>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <i className="fa fa-weixin"></i>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* 导入文档弹窗 */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={(document) => {
          loadDocuments();
          navigate(`/editor/${document.id}`);
        }}
      />
    </div>
  );
}

