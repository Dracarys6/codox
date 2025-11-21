import { useState, useEffect } from 'react';
import { DocumentVersion, VersionDiffResponse, DiffSegment } from '../types';
import { apiClient } from '../api/client';

interface VersionDiffViewProps {
    docId: number;
    baseVersionId?: number;
    targetVersionId: number;
    onClose?: () => void;
}

export function VersionDiffView({
    docId,
    baseVersionId,
    targetVersionId,
    onClose,
}: VersionDiffViewProps) {
    const [diff, setDiff] = useState<VersionDiffResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [baseVersion, setBaseVersion] = useState<DocumentVersion | null>(null);
    const [targetVersion, setTargetVersion] = useState<DocumentVersion | null>(null);

    useEffect(() => {
        const loadDiff = async () => {
            setLoading(true);
            setError(null);
            try {
                const [diffData, targetData] = await Promise.all([
                    apiClient.getVersionDiff(docId, targetVersionId, baseVersionId),
                    apiClient.getDocumentVersion(docId, targetVersionId),
                ]);

                setDiff(diffData);
                setTargetVersion(targetData);

                if (baseVersionId) {
                    const baseData = await apiClient.getDocumentVersion(docId, baseVersionId);
                    setBaseVersion(baseData);
                }
            } catch (err: any) {
                setError(err.response?.data?.error || '加载版本差异失败');
            } finally {
                setLoading(false);
            }
        };

        if (docId > 0 && targetVersionId > 0) {
            loadDiff();
        }
    }, [docId, baseVersionId, targetVersionId]);

    const renderSegment = (segment: DiffSegment, index: number) => {
        const lines = segment.text.split('\n').filter((line) => line !== '' || segment.text.includes('\n'));
        const bgColor =
            segment.op === 'insert'
                ? 'bg-green-50 border-l-4 border-green-500'
                : segment.op === 'delete'
                  ? 'bg-red-50 border-l-4 border-red-500'
                  : 'bg-white';

        return (
            <div key={index} className={`p-2 ${bgColor}`}>
                {lines.map((line, lineIndex) => (
                    <div
                        key={lineIndex}
                        className={`font-mono text-sm ${
                            segment.op === 'insert'
                                ? 'text-green-800'
                                : segment.op === 'delete'
                                  ? 'text-red-800'
                                  : 'text-gray-800'
                        }`}
                    >
                        <span className="mr-2 text-gray-500">
                            {segment.op === 'insert' ? '+' : segment.op === 'delete' ? '-' : ' '}
                        </span>
                        {line || '\u00A0'}
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="version-diff-view p-8">
                <div className="text-center text-gray-500">加载差异中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="version-diff-view p-8">
                <div className="text-center text-red-500">{error}</div>
            </div>
        );
    }

    if (!diff) {
        return null;
    }

    const stats = {
        insert: diff.diff.filter((s) => s.op === 'insert').length,
        delete: diff.diff.filter((s) => s.op === 'delete').length,
        equal: diff.diff.filter((s) => s.op === 'equal').length,
    };

    return (
        <div className="version-diff-view">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">版本差异对比</h3>
                    <div className="text-sm text-gray-500 mt-1">
                        {baseVersionId ? (
                            <>
                                基础版本: {baseVersion?.version_number || baseVersionId} → 目标版本:{' '}
                                {targetVersion?.version_number || targetVersionId}
                            </>
                        ) : (
                            <>当前版本 → 版本 {targetVersion?.version_number || targetVersionId}</>
                        )}
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        关闭
                    </button>
                )}
            </div>

            <div className="mb-4 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-green-100 border border-green-500 rounded"></span>
                    <span className="text-gray-700">新增 ({stats.insert})</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-red-100 border border-red-500 rounded"></span>
                    <span className="text-gray-700">删除 ({stats.delete})</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-white border border-gray-300 rounded"></span>
                    <span className="text-gray-700">未变更 ({stats.equal})</span>
                </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <div className="text-sm font-medium text-gray-700">差异内容</div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {diff.diff.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">两个版本内容相同</div>
                    ) : (
                        diff.diff.map((segment, index) => renderSegment(segment, index))
                    )}
                </div>
            </div>
        </div>
    );
}

