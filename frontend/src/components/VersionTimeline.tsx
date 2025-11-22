import { useState, useEffect } from 'react';
import { DocumentVersion, VersionListParams } from '../types';
import { apiClient } from '../api/client';

interface VersionTimelineProps {
    docId: number;
    onVersionSelect?: (version: DocumentVersion) => void;
    onRestore?: (version: DocumentVersion) => void;
    showFilters?: boolean;
}

export function VersionTimeline({ docId, onVersionSelect, onRestore, showFilters = true }: VersionTimelineProps) {
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<VersionListParams>({});
    const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);

    const loadVersions = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getDocumentVersions(docId, filters);
            setVersions(response.versions || []);
        } catch (err: any) {
            setError(err.response?.data?.error || '加载版本列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (docId > 0) {
            loadVersions();
        }
    }, [docId, filters]);

    const handleVersionClick = (version: DocumentVersion) => {
        setSelectedVersion(version);
        onVersionSelect?.(version);
    };

    const handleRestore = async (version: DocumentVersion) => {
        if (!window.confirm(`确定要恢复到版本 ${version.version_number} 吗？这将创建一个新的版本记录并更新文档内容。`)) {
            return;
        }

        try {
            await apiClient.restoreVersion(docId, version.id);
            alert('版本恢复成功！文档内容已更新。');
            onRestore?.(version);
            loadVersions(); // 重新加载列表
        } catch (err: any) {
            alert(err.response?.data?.error || '恢复版本失败');
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'manual':
                return '手动';
            case 'restore':
                return '恢复';
            case 'auto':
            default:
                return '自动';
        }
    };

    const getSourceColor = (source: string) => {
        switch (source) {
            case 'manual':
                return 'bg-blue-100 text-blue-800';
            case 'restore':
                return 'bg-purple-100 text-purple-800';
            case 'auto':
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="version-timeline">
            {showFilters && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">筛选条件</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-gray-700 mb-1">开始日期</label>
                            <input
                                type="date"
                                value={filters.start_date || ''}
                                onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-700 mb-1">结束日期</label>
                            <input
                                type="date"
                                value={filters.end_date || ''}
                                onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-700 mb-1">创建人 ID</label>
                            <input
                                type="number"
                                value={filters.created_by || ''}
                                onChange={(e) =>
                                    setFilters({
                                        ...filters,
                                        created_by: e.target.value ? parseInt(e.target.value) : undefined,
                                    })
                                }
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                                placeholder="可选"
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={() => setFilters({})}
                            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            清除筛选
                        </button>
                    </div>
                </div>
            )}

            {loading && <div className="text-center py-8 text-gray-500">加载中...</div>}
            {error && <div className="text-center py-8 text-red-500">{error}</div>}

            {!loading && !error && versions.length === 0 && (
                <div className="text-center py-8 text-gray-500">暂无版本记录</div>
            )}

            {!loading && !error && versions.length > 0 && (
                <div className="space-y-3">
                    {versions.map((version) => (
                        <div
                            key={version.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                selectedVersion?.id === version.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleVersionClick(version)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-semibold text-gray-900">
                                            版本 {version.version_number}
                                        </span>
                                        <span
                                            className={`px-2 py-1 text-xs rounded-full ${getSourceColor(version.source)}`}
                                        >
                                            {getSourceLabel(version.source)}
                                        </span>
                                    </div>
                                    {version.change_summary && (
                                        <p className="text-sm text-gray-700 mb-2">{version.change_summary}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>
                                            {version.creator_nickname || version.creator_email || `用户 ${version.created_by}`}
                                        </span>
                                        <span>•</span>
                                        <span>{formatDate(version.created_at)}</span>
                                        <span>•</span>
                                        <span>{(version.size_bytes / 1024).toFixed(2)} KB</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    {onVersionSelect && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleVersionClick(version);
                                            }}
                                            className="px-3 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                                        >
                                            查看
                                        </button>
                                    )}
                                    {onRestore && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRestore(version);
                                            }}
                                            className="px-3 py-1 text-xs text-purple-600 bg-purple-50 rounded hover:bg-purple-100"
                                        >
                                            恢复
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

