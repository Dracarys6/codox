import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { apiClient } from '../api/client';
import { Document, DocumentListResponse } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function DocumentListPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    useEffect(() => {
        loadDocuments();
    }, [page]);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            setError(null);
            const response: DocumentListResponse = await apiClient.getDocumentList({
                page,
                pageSize,
            });
            setDocuments(response.docs || []);
            setTotal(response.total || 0);
            setTotalPages(Math.ceil((response.total || 0) / pageSize));
        } catch (err: any) {
            setError(err.response?.data?.error || '加载文档列表失败');
            console.error('Failed to load documents:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (docId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('确定要删除这个文档吗？此操作不可撤销。')) {
            return;
        }

        try {
            await apiClient.deleteDocument(docId);
            // 重新加载列表
            loadDocuments();
        } catch (err: any) {
            alert(err.response?.data?.error || '删除文档失败');
            console.error('Failed to delete document:', err);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getTagNames = (tags: Document['tags']): string[] => {
        if (!tags || tags.length === 0) return [];
        if (typeof tags[0] === 'string') {
            return tags as string[];
        }
        return (tags as { id: number; name: string }[]).map((tag) => tag.name);
    };

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* 页面标题和操作栏 */}
                    <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600">
                                我的文档
                            </h1>
                            <p className="mt-2 text-sm text-gray-600">
                                共 {total} 个文档
                            </p>
                        </div>
                        <Link
                            to="/docs/new"
                            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95"
                        >
                            创建新文档
                        </Link>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* 加载状态 */}
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                            <p className="mt-4 text-gray-600">加载中...</p>
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">还没有文档</h3>
                            <p className="mt-2 text-sm text-gray-600">创建你的第一个文档开始使用吧！</p>
                            <div className="mt-6">
                                <Link
                                    to="/docs/new"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    创建文档
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 文档列表 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        onClick={() => navigate(`/docs/${doc.id}`)}
                                        className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 cursor-pointer hover:-translate-y-1 p-6"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
                                                {doc.title}
                                            </h3>
                                            {doc.is_locked && (
                                                <span className="text-xs text-amber-500 flex-shrink-0 ml-2">已锁定</span>
                                            )}
                                        </div>

                                        {/* 标签 */}
                                        {getTagNames(doc.tags).length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {getTagNames(doc.tags).slice(0, 3).map((tag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {getTagNames(doc.tags).length > 3 && (
                                                    <span className="px-2 py-1 text-xs font-medium text-gray-500">
                                                        +{getTagNames(doc.tags).length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* 文档信息 */}
                                        <div className="text-sm text-gray-600 space-y-1 mb-4">
                                            <div className="flex items-center">
                                                <span className="text-gray-500">更新时间：</span>
                                                <span className="ml-2">{formatDate(doc.updated_at)}</span>
                                            </div>
                                        </div>

                                        {/* 操作按钮 */}
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                            <div className="text-xs text-gray-500">
                                                {doc.owner_id === user?.id ? (
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                                        我的
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                                        共享
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    to={`/docs/${doc.id}/edit`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    编辑
                                                </Link>
                                                {doc.owner_id === user?.id && (
                                                    <button
                                                        onClick={(e) => handleDelete(doc.id, e)}
                                                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                                                    >
                                                        删除
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 分页 */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        上一页
                                    </button>
                                    <span className="px-4 py-2 text-sm text-gray-700">
                                        第 {page} / {totalPages} 页
                                    </span>
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        下一页
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}

