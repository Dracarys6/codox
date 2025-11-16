import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { Document, DocumentListParams } from '../types';
import { NotificationBell } from '../components/NotificationBell';

export function DocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [sortOption, setSortOption] = useState<'recent' | 'name' | 'created' | 'modified'>('recent');
  const [filterOption, setFilterOption] = useState<'all' | 'my' | 'shared' | 'recent'>('all');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const pageSize = 10;

  useEffect(() => {
    loadDocuments();
  }, [currentPage, filterOption, selectedTag]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const params: DocumentListParams = {
        page: currentPage,
        pageSize,
      };
      if (filterOption === 'my' && user) {
        params.author = user.id;
      }
      if (selectedTag !== 'all') {
        params.tag = selectedTag;
      }

      const response = await apiClient.getDocumentList(params);
      setDocuments(response.docs);
      setTotal(response.total);
      setSelectedDocs([]);
    } catch (error) {
      console.error('加载文档失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    documents.forEach((doc) => {
      if (Array.isArray(doc.tags)) {
        doc.tags.forEach((tag) => tags.add(typeof tag === 'string' ? tag : tag.name));
      }
    });
    return Array.from(tags);
  }, [documents]);

  const filteredDocs = useMemo(() => {
    let result = [...documents];

    if (filterOption === 'shared' && user) {
      result = result.filter((doc) => doc.owner_id !== user.id);
    } else if (filterOption === 'recent') {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      result = result.filter((doc) => now - new Date(doc.updated_at).getTime() <= sevenDays);
    }

    if (searchTerm.trim()) {
      const keyword = searchTerm.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.title.toLowerCase().includes(keyword) ||
          (Array.isArray(doc.tags) &&
            doc.tags.some((tag) => (typeof tag === 'string' ? tag : tag.name).toLowerCase().includes(keyword)))
      );
    }

    switch (sortOption) {
      case 'name':
        result.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
        break;
      case 'created':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'modified':
        result.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        break;
      default:
        result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    return result;
  }, [documents, searchTerm, sortOption, filterOption, user]);

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

  const handleDeleteDocument = async (id: number) => {
    if (!confirm('确定要删除这个文档吗？')) return;

    try {
      await apiClient.deleteDocument(id);
      loadDocuments();
    } catch (error) {
      alert('删除文档失败');
    }
  };

  const handleSelectDocument = (id: number) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedDocs(checked ? filteredDocs.map((doc) => doc.id) : []);
  };

  const handleBulkDelete = async () => {
    if (selectedDocs.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedDocs.length} 个文档吗？`)) return;

    try {
      await Promise.all(selectedDocs.map((docId) => apiClient.deleteDocument(docId)));
      loadDocuments();
    } catch (error) {
      alert('批量删除失败');
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  const isSharedDoc = (doc: Document) => (user ? doc.owner_id !== user.id : false);

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
                  className="text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium"
                >
                  首页
                </Link>
                <Link
                  to="/documents"
                  className="text-primary border-primary inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  我的文档
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

              <Link
                to="/profile"
                className="flex items-center max-w-xs rounded-full text-sm ml-2"
              >
                <img
                  className="h-8 w-8 rounded-full object-cover"
                  src={user?.profile?.avatar_url || 'https://picsum.photos/id/1005/200/200'}
                  alt="用户头像"
                />
                <span className="ml-2 hidden md:block">{user?.profile?.nickname || user?.email}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面标题和操作栏 */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">我的文档</h1>
                <p className="text-gray-500">管理您的所有文档和协作项目</p>
              </div>
              <div className="mt-4 md:mt-0 flex gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-custom"
                >
                  <i className={`fa ${viewMode === 'table' ? 'fa-th-large' : 'fa-list'} mr-2`}></i>
                  {viewMode === 'table' ? '卡片视图' : '列表视图'}
                </button>
                <button
                  onClick={handleCreateDocument}
                  className="inline-flex items-center px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-custom shadow-lg shadow-primary/20"
                >
                  <i className="fa fa-plus mr-2"></i>新建文档
                </button>
              </div>
            </div>

            {/* 搜索栏 */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fa fa-search text-gray-400"></i>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索文档名称、内容..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                >
                  <option value="recent">最近编辑</option>
                  <option value="name">按名称</option>
                  <option value="created">创建时间</option>
                  <option value="modified">最早修改</option>
                </select>
                <select
                  value={filterOption}
                  onChange={(e) => {
                    setFilterOption(e.target.value as typeof filterOption);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                >
                  <option value="all">全部文档</option>
                  <option value="my">我的文档</option>
                  <option value="shared">共享给我</option>
                  <option value="recent">最近访问</option>
                </select>
                <select
                  value={selectedTag}
                  onChange={(e) => {
                    setSelectedTag(e.target.value as typeof selectedTag);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom outline-none"
                >
                  <option value="all">所有标签</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
              </div>
            </div>
          </div>

          {/* 批量操作 */}
          {selectedDocs.length > 0 && (
            <div className="bg-white border border-primary/20 rounded-xl p-4 mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                已选择 <span className="font-semibold text-primary">{selectedDocs.length}</span> 个文档
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 text-sm text-danger border border-danger/30 rounded-lg hover:bg-danger/10 transition-custom"
                >
                  批量删除
                </button>
                <button
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-custom"
                  onClick={() => setSelectedDocs([])}
                >
                  取消选择
                </button>
              </div>
            </div>
          )}

          {/* 文档列表 */}
          {isLoading ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <i className="fa fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
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
          ) : viewMode === 'table' ? (
            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedDocs.length === filteredDocs.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文档名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      所有者
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
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedDocs.includes(doc.id)}
                          onChange={() => handleSelectDocument(doc.id)}
                        />
                      </td>
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
                        <div className="text-sm text-gray-500">{isSharedDoc(doc) ? '协作者' : '我自己'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(doc.updated_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {doc.is_locked ? '已锁定' : '已保存'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/editor/${doc.id}`}
                          className="text-primary hover:text-primary/80 mr-4"
                        >
                          编辑
                        </Link>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-danger hover:text-danger/80"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 card-hover"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center text-primary">
                      <i className="fa fa-file-text-o text-xl"></i>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    <Link to={`/editor/${doc.id}`} className="hover:text-primary">
                      {doc.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {formatDate(doc.updated_at)}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">
                      {doc.is_locked ? '已锁定' : '已保存'}
                    </span>
                    <div className="flex gap-2">
                      <Link
                        to={`/editor/${doc.id}`}
                        className="text-primary hover:text-primary/80 text-sm"
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-danger hover:text-danger/80 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 分页 */}
          {total > pageSize && filteredDocs.length > 0 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                显示 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, total)} 条，共 {total} 条
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-custom disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa fa-chevron-left mr-1"></i>上一页
                </button>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage * pageSize >= total}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-custom disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页<i className="fa fa-chevron-right ml-1"></i>
                </button>
              </div>
            </div>
          )}
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

