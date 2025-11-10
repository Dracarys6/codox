import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AclManager } from '../components/AclManager';
import { apiClient } from '../api/client';
import { Document, DocumentAcl, DocumentVersion } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function DocumentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [document, setDocument] = useState<Document | null>(null);
    const [acl, setAcl] = useState<DocumentAcl | null>(null);
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'acl' | 'versions'>('info');

    useEffect(() => {
        if (id) {
            loadDocument();
        }
    }, [id]);

    const loadDocument = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const doc = await apiClient.getDocument(parseInt(id));
            setDocument(doc);
        } catch (err: any) {
            setError(err.response?.data?.error || '加载文档失败');
            console.error('Failed to load document:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadAcl = async () => {
        if (!id) return;
        try {
            const aclData = await apiClient.getDocumentAcl(parseInt(id));
            setAcl(aclData);
        } catch (err: any) {
            console.error('Failed to load ACL:', err);
        }
    };

    const loadVersions = async () => {
        if (!id) return;
        try {
            const response = await apiClient.getDocumentVersions(parseInt(id));
            setVersions(response.versions || []);
        } catch (err: any) {
            console.error('Failed to load versions:', err);
        }
    };

    const handleDelete = async () => {
        if (!id || !window.confirm('确定要删除这个文档吗？此操作不可撤销。')) {
            return;
        }

        try {
            await apiClient.deleteDocument(parseInt(id));
            navigate('/docs');
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
            second: '2-digit',
        });
    };

    const getTagNames = (tags: Document['tags']): string[] => {
        if (!tags || tags.length === 0) return [];
        if (typeof tags[0] === 'string') {
            return tags as string[];
        }
        return (tags as { id: number; name: string }[]).map((tag) => tag.name);
    };

    const isOwner = document && user && document.owner_id === user.id;

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">加载中...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (error || !document) {
        return (
            <Layout>
                <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-red-600 mb-4">{error || '文档不存在'}</p>
                        <Link
                            to="/docs"
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            返回文档列表
                        </Link>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* 返回按钮和操作栏 */}
                    <div className="mb-6 flex flex-col items-center space-y-3">
                        <div className="w-full text-center">
                            <Link
                                to="/docs"
                                className="inline-block text-sm text-gray-600 hover:text-gray-900"
                            >
                                返回文档列表
                            </Link>
                        </div>
                        <div className="w-full text-center">
                            <Link
                                to={`/docs/${document.id}/edit`}
                                className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                编辑
                            </Link>
                        </div>
                        {isOwner && (
                            <div className="w-full text-center">
                                <button
                                    onClick={handleDelete}
                                    className="inline-block px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    删除
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 文档标题 */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
                        <div className="flex items-start justify-between mb-4">
                            <h1 className="text-3xl font-extrabold text-gray-900 flex-1">
                                {document.title}
                            </h1>
                            {document.is_locked && (
                                <div className="flex items-center ml-4 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                                    已锁定
                                </div>
                            )}
                        </div>

                        {/* 标签 */}
                        {getTagNames(document.tags).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {getTagNames(document.tags).map((tag, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* 文档信息 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">文档ID</span>
                                <p className="font-semibold text-gray-900">{document.id}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">创建时间</span>
                                <p className="font-semibold text-gray-900">
                                    {formatDate(document.created_at)}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-500">更新时间</span>
                                <p className="font-semibold text-gray-900">
                                    {formatDate(document.updated_at)}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-500">所有者</span>
                                <p className="font-semibold text-gray-900">
                                    {isOwner ? '我' : `用户 ${document.owner_id}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 标签页 */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100">
                        <div className="border-b border-gray-200">
                            <nav className="flex -mb-px">
                                <button
                                    onClick={() => setActiveTab('info')}
                                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === 'info'
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    文档信息
                                </button>
                                {isOwner && (
                                    <button
                                        onClick={() => {
                                            setActiveTab('acl');
                                            loadAcl();
                                        }}
                                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                            activeTab === 'acl'
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        权限管理
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setActiveTab('versions');
                                        loadVersions();
                                    }}
                                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === 'versions'
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    版本历史
                                </button>
                            </nav>
                        </div>

                        <div className="p-6">
                            {activeTab === 'info' && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                        文档详情
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-gray-500">标题：</span>
                                            <span className="ml-2 font-medium">{document.title}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">状态：</span>
                                            <span className="ml-2 font-medium">
                                                {document.is_locked ? '已锁定' : '正常'}
                                            </span>
                                        </div>
                                        {document.last_published_version_id && (
                                            <div>
                                                <span className="text-gray-500">已发布版本ID：</span>
                                                <span className="ml-2 font-medium">
                                                    {document.last_published_version_id}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'acl' && isOwner && (
                                <AclManager docId={parseInt(id!)} onUpdate={loadAcl} />
                            )}

                            {activeTab === 'versions' && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                        版本历史
                                    </h3>
                                    {versions.length > 0 ? (
                                        <div className="space-y-3">
                                            {versions.map((version) => (
                                                <div
                                                    key={version.id}
                                                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-semibold text-gray-900">
                                                            版本 {version.id}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            {formatDate(version.created_at)}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-600 space-y-1">
                                                        <div>
                                                            <span className="text-gray-500">大小：</span>
                                                            <span>
                                                                {(version.size_bytes / 1024).toFixed(2)} KB
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">SHA256：</span>
                                                            <span className="font-mono text-xs">
                                                                {version.snapshot_sha256.substring(0, 16)}...
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500">暂无版本记录</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

