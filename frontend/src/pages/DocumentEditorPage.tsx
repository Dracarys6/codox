import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DocumentEditor } from '../components/DocumentEditor';
import { apiClient } from '../api/client';
import { Document } from '../types';

export function DocumentEditorPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [document, setDocument] = useState<Document | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const handleSave = () => {
        // 快照已自动保存，这里可以显示保存成功的提示
        console.log('Document saved successfully');
    };

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">加载中...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!document || !id) {
        return (
            <Layout>
                <div className="min-h-screen bg-gray-50 py-8">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                {error}
                            </div>
                        )}
                        <div className="text-center py-12">
                            <p className="text-red-600 text-lg">文档不存在</p>
                            <button
                                onClick={() => navigate('/docs')}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                返回文档列表
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* 返回按钮和标题 */}
                    <div className="mb-6 flex flex-col space-y-3">
                        {/* 返回按钮 - 单独一行 */}
                        <div className="w-full text-center">
                            <button
                                onClick={() => navigate(`/docs/${id}`)}
                                className="text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                返回文档详情
                            </button>
                        </div>
                        {/* 文档标题 - 单独一行 */}
                        <div className="w-full text-center">
                            <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
                        </div>
                        {/* 描述信息 - 单独一行 */}
                        <div className="w-full text-center">
                            <p className="text-sm text-gray-500">
                                实时协作编辑 - 您的更改会自动保存
                            </p>
                        </div>
                    </div>

                    {/* 编辑器 */}
                    <DocumentEditor docId={parseInt(id)} onSave={handleSave} />

                    {/* 提示信息 - 单独一行 */}
                    <div className="mt-4 text-center">
                        <p className="text-sm text-gray-500">💡 提示：文档会每 30 秒自动保存一次快照</p>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

