import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';

interface SearchResult {
    id: number;
    title: string;
    content: string;
    _formatted?: {
        title?: string;
        content?: string;
    };
}

export function SearchPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    const handleSearch = async (e: FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        try {
            setLoading(true);
            setCurrentPage(1);
            const response = await apiClient.searchDocuments(query.trim(), {
                page: 1,
                page_size: pageSize,
            });
            setResults(response.hits || []);
            setTotal(response.total || 0);
        } catch (err: any) {
            console.error('Search failed:', err);
            alert(err.response?.data?.error || '搜索失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (loading || results.length >= total) return;

        try {
            setLoading(true);
            const nextPage = currentPage + 1;
            const response = await apiClient.searchDocuments(query.trim(), {
                page: nextPage,
                page_size: pageSize,
            });
            setResults([...results, ...(response.hits || [])]);
            setCurrentPage(nextPage);
        } catch (err: any) {
            console.error('Load more failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const highlightText = (text: string, query: string) => {
        if (!text || !query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, index) =>
            regex.test(part) ? (
                <mark key={index} className="bg-warning/30 text-warning-800 px-1 rounded">
                    {part}
                </mark>
            ) : (
                part
            )
        );
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

                        <div className="flex items-center">
                            <Link
                                to="/profile"
                                className="flex items-center max-w-xs rounded-full text-sm"
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
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">搜索文档</h1>

                    {/* 搜索表单 */}
                    <form onSubmit={handleSearch} className="mb-8">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="fa fa-search text-gray-400"></i>
                                </div>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="输入搜索关键词..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !query.trim()}
                                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-custom shadow-lg shadow-primary/20"
                            >
                                {loading ? (
                                    <>
                                        <i className="fa fa-spinner fa-spin mr-2"></i>搜索中...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-search mr-2"></i>搜索
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* 搜索结果 */}
                    {results.length > 0 && (
                        <div className="mb-4 text-sm text-gray-500">
                            找到 {total} 个结果
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-4">
                            {results.map((result) => (
                                <Link
                                    key={result.id}
                                    to={`/editor/${result.id}`}
                                    className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-custom border border-gray-100"
                                >
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {result._formatted?.title
                                            ? highlightText(result._formatted.title, query)
                                            : result.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 line-clamp-3">
                                        {result._formatted?.content
                                            ? highlightText(result._formatted.content, query)
                                            : result.content}
                                    </p>
                                    <div className="mt-3 flex items-center text-xs text-gray-400">
                                        <i className="fa fa-file-text-o mr-1"></i>
                                        <span>文档 ID: {result.id}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* 加载更多 */}
                    {results.length > 0 && results.length < total && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={handleLoadMore}
                                disabled={loading}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-custom"
                            >
                                {loading ? (
                                    <>
                                        <i className="fa fa-spinner fa-spin mr-2"></i>加载中...
                                    </>
                                ) : (
                                    <>
                                        加载更多 ({total - results.length} 个结果)
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* 空状态 */}
                    {!loading && query && results.length === 0 && (
                        <div className="text-center py-16">
                            <i className="fa fa-search text-6xl text-gray-300 mb-4"></i>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">未找到相关文档</h3>
                            <p className="text-gray-500">请尝试使用其他关键词搜索</p>
                        </div>
                    )}

                    {/* 初始状态 */}
                    {!query && results.length === 0 && (
                        <div className="text-center py-16">
                            <i className="fa fa-search text-6xl text-gray-300 mb-4"></i>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">搜索文档</h3>
                            <p className="text-gray-500">在上方输入关键词开始搜索</p>
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

