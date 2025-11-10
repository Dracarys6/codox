import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { apiClient } from '../api/client';
import { Document } from '../types';

export function DocumentEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        if (isEdit && id) {
            loadDocument();
        }
    }, [id, isEdit]);

    const loadDocument = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const doc = await apiClient.getDocument(parseInt(id));
            setTitle(doc.title);
            setIsLocked(doc.is_locked);
            // 处理标签格式
            if (doc.tags && doc.tags.length > 0) {
                if (typeof doc.tags[0] === 'string') {
                    setTags(doc.tags as string[]);
                } else {
                    setTags((doc.tags as { id: number; name: string }[]).map((t) => t.name));
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || '加载文档失败');
            console.error('Failed to load document:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTag = () => {
        const trimmedTag = tagInput.trim();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            setTags([...tags, trimmedTag]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter((tag) => tag !== tagToRemove));
    };

    const handleTagInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('标题不能为空');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            if (isEdit && id) {
                await apiClient.updateDocument(parseInt(id), {
                    title: title.trim(),
                    is_locked: isLocked,
                    tags: tags,
                });
            } else {
                const newDoc = await apiClient.createDocument({
                    title: title.trim(),
                    tags: tags,
                });
                navigate(`/docs/${newDoc.id}`);
                return;
            }

            navigate(`/docs/${id}`);
        } catch (err: any) {
            setError(err.response?.data?.error || '保存失败');
            console.error('Failed to save document:', err);
        } finally {
            setSaving(false);
        }
    };

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

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* 页面标题 */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600">
                            {isEdit ? '编辑文档' : '创建新文档'}
                        </h1>
                    </div>

                    {/* 表单 */}
                    <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
                        {/* 错误提示 */}
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* 标题输入 */}
                        <div className="mb-6">
                            <label
                                htmlFor="title"
                                className="block text-sm font-semibold text-gray-700 mb-2"
                            >
                                文档标题 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="输入文档标题"
                                required
                                maxLength={255}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                {title.length}/255 字符
                            </p>
                        </div>

                        {/* 锁定状态 */}
                        {isEdit && (
                            <div className="mb-6">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isLocked}
                                        onChange={(e) => setIsLocked(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-3 text-sm font-semibold text-gray-700">
                                        锁定文档
                                    </span>
                                </label>
                                <p className="mt-1 ml-8 text-xs text-gray-500">
                                    锁定后，其他用户将无法编辑此文档
                                </p>
                            </div>
                        )}

                        {/* 标签输入 */}
                        <div className="mb-6">
                            <label
                                htmlFor="tags"
                                className="block text-sm font-semibold text-gray-700 mb-2"
                            >
                                标签
                            </label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    id="tags"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyPress={handleTagInputKeyPress}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="输入标签并按回车添加"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddTag}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    添加
                                </button>
                            </div>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(tag)}
                                                className="ml-2 text-blue-600 hover:text-blue-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="px-6 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={saving || !title.trim()}
                                className="px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-lg hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {saving ? '保存中...' : isEdit ? '保存更改' : '创建文档'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
}

