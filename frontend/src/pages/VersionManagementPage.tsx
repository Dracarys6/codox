import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentVersion } from '../types';
import { VersionTimeline } from '../components/VersionTimeline';
import { VersionDiffView } from '../components/VersionDiffView';
import { apiClient } from '../api/client';

export function VersionManagementPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const docId = id ? parseInt(id) : 0;

    const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
    const [showDiff, setShowDiff] = useState(false);
    const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);

    const handleVersionSelect = (version: DocumentVersion) => {
        setSelectedVersion(version);
        setShowDiff(false);
    };

    const handleRestore = async (version: DocumentVersion) => {
        setPreviewVersion(version);
        if (window.confirm(`确定要恢复到版本 ${version.version_number} 吗？这将创建一个新的版本记录。`)) {
            // 恢复逻辑已在 VersionTimeline 中处理
            setPreviewVersion(null);
        }
    };

    const handlePreview = (version: DocumentVersion) => {
        setPreviewVersion(version);
    };

    if (!docId) {
        return <div className="p-8 text-center text-red-500">无效的文档 ID</div>;
    }

    return (
        <div className="version-management-page p-8 max-w-7xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">版本管理</h1>
                    <p className="text-sm text-gray-500 mt-1">文档 ID: {docId}</p>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    返回
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左侧：版本列表 */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">版本历史</h2>
                        <VersionTimeline
                            docId={docId}
                            onVersionSelect={handleVersionSelect}
                            onRestore={handleRestore}
                            showFilters={true}
                        />
                    </div>
                </div>

                {/* 右侧：版本详情和对比 */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        {selectedVersion ? (
                            <>
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        版本 {selectedVersion.version_number} 详情
                                    </h2>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowDiff(!showDiff)}
                                            className="px-3 py-1 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                                        >
                                            {showDiff ? '隐藏对比' : '查看差异'}
                                        </button>
                                        <button
                                            onClick={() => handlePreview(selectedVersion)}
                                            className="px-3 py-1 text-sm text-purple-600 bg-purple-50 rounded hover:bg-purple-100"
                                        >
                                            预览
                                        </button>
                                    </div>
                                </div>

                                {showDiff ? (
                                    <VersionDiffView
                                        docId={docId}
                                        targetVersionId={selectedVersion.id}
                                        onClose={() => setShowDiff(false)}
                                    />
                                ) : (
                                    <div className="version-details space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">版本号</label>
                                            <p className="mt-1 text-sm text-gray-900">{selectedVersion.version_number}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">创建时间</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {new Date(selectedVersion.created_at).toLocaleString('zh-CN')}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">创建人</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {selectedVersion.creator_nickname ||
                                                    selectedVersion.creator_email ||
                                                    `用户 ${selectedVersion.created_by}`}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">来源</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {selectedVersion.source === 'manual'
                                                    ? '手动'
                                                    : selectedVersion.source === 'restore'
                                                      ? '恢复'
                                                      : '自动'}
                                            </p>
                                        </div>
                                        {selectedVersion.change_summary && (
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">变更摘要</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {selectedVersion.change_summary}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">文件大小</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {(selectedVersion.size_bytes / 1024).toFixed(2)} KB
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">SHA256</label>
                                            <p className="mt-1 text-sm text-gray-900 font-mono text-xs break-all">
                                                {selectedVersion.snapshot_sha256}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <p>请从左侧选择一个版本查看详情</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 版本预览模态框 */}
            {previewVersion && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">
                                预览版本 {previewVersion.version_number}
                            </h3>
                            <button
                                onClick={() => setPreviewVersion(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            {previewVersion.content_html ? (
                                <div
                                    className="prose max-w-none"
                                    dangerouslySetInnerHTML={{ __html: previewVersion.content_html }}
                                />
                            ) : previewVersion.content_text ? (
                                <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
                                    {previewVersion.content_text}
                                </pre>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    该版本没有可预览的内容
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewVersion(null)}
                                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                关闭
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await apiClient.restoreVersion(docId, previewVersion.id);
                                        alert('版本恢复成功！');
                                        setPreviewVersion(null);
                                        window.location.reload();
                                    } catch (err: any) {
                                        alert(err.response?.data?.error || '恢复版本失败');
                                    }
                                }}
                                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700"
                            >
                                确认恢复
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

