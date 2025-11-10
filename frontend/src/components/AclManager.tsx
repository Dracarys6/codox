import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { DocumentAcl, AclEntry, UpdateAclRequest } from '../types';

interface AclManagerProps {
    docId: number;
    onUpdate?: () => void;
}

export function AclManager({ docId, onUpdate }: AclManagerProps) {
    const [acl, setAcl] = useState<DocumentAcl | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newUserId, setNewUserId] = useState('');
    const [newPermission, setNewPermission] = useState<'editor' | 'viewer'>('editor');

    useEffect(() => {
        loadAcl();
    }, [docId]);

    const loadAcl = async () => {
        try {
            setLoading(true);
            setError(null);
            const aclData = await apiClient.getDocumentAcl(docId);
            setAcl(aclData);
        } catch (err: any) {
            setError(err.response?.data?.error || '加载权限列表失败');
            console.error('Failed to load ACL:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAcl = async () => {
        if (!newUserId.trim()) {
            setError('请输入用户ID');
            return;
        }

        const userId = parseInt(newUserId);
        if (isNaN(userId)) {
            setError('用户ID必须是数字');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            const currentAcl = acl?.acl || [];
            // 检查是否已存在
            if (currentAcl.some((entry) => entry.user_id === userId)) {
                setError('该用户已在权限列表中');
                setSaving(false);
                return;
            }

            const updatedAcl: UpdateAclRequest = {
                acl: [...currentAcl, { user_id: userId, permission: newPermission }],
            };

            await apiClient.updateDocumentAcl(docId, updatedAcl);
            setNewUserId('');
            await loadAcl();
            onUpdate?.();
        } catch (err: any) {
            setError(err.response?.data?.error || '添加权限失败');
            console.error('Failed to add ACL:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdatePermission = async (userId: number, permission: 'owner' | 'editor' | 'viewer') => {
        try {
            setSaving(true);
            setError(null);

            const currentAcl = acl?.acl || [];
            const updatedAcl: UpdateAclRequest = {
                acl: currentAcl.map((entry) =>
                    entry.user_id === userId ? { ...entry, permission } : entry
                ),
            };

            await apiClient.updateDocumentAcl(docId, updatedAcl);
            await loadAcl();
            onUpdate?.();
        } catch (err: any) {
            setError(err.response?.data?.error || '更新权限失败');
            console.error('Failed to update ACL:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveAcl = async (userId: number) => {
        if (!window.confirm('确定要移除该用户的权限吗？')) {
            return;
        }

        try {
            setSaving(true);
            setError(null);

            const currentAcl = acl?.acl || [];
            // 过滤掉要删除的用户，但保留owner
            const updatedAcl: UpdateAclRequest = {
                acl: currentAcl.filter(
                    (entry) => entry.user_id !== userId || entry.permission === 'owner'
                ),
            };

            await apiClient.updateDocumentAcl(docId, updatedAcl);
            await loadAcl();
            onUpdate?.();
        } catch (err: any) {
            setError(err.response?.data?.error || '移除权限失败');
            console.error('Failed to remove ACL:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">加载中...</p>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">访问控制列表</h3>

            {/* 错误提示 */}
            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* 添加新权限 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">添加用户权限</h4>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={newUserId}
                        onChange={(e) => setNewUserId(e.target.value)}
                        placeholder="用户ID"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <select
                        value={newPermission}
                        onChange={(e) => setNewPermission(e.target.value as 'editor' | 'viewer')}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                        <option value="editor">编辑者</option>
                        <option value="viewer">查看者</option>
                    </select>
                    <button
                        onClick={handleAddAcl}
                        disabled={saving || !newUserId.trim()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        添加
                    </button>
                </div>
            </div>

            {/* 权限列表 */}
            {acl && acl.acl.length > 0 ? (
                <div className="space-y-2">
                    {acl.acl.map((entry, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-gray-900 font-medium">用户 {entry.user_id}</span>
                                {entry.permission === 'owner' && (
                                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                                        所有者
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {entry.permission !== 'owner' && (
                                    <>
                                        <select
                                            value={entry.permission}
                                            onChange={(e) =>
                                                handleUpdatePermission(
                                                    entry.user_id,
                                                    e.target.value as 'owner' | 'editor' | 'viewer'
                                                )
                                            }
                                            disabled={saving}
                                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                                        >
                                            <option value="editor">编辑者</option>
                                            <option value="viewer">查看者</option>
                                        </select>
                                        <button
                                            onClick={() => handleRemoveAcl(entry.user_id)}
                                            disabled={saving}
                                            className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                                        >
                                            移除
                                        </button>
                                    </>
                                )}
                                {entry.permission === 'owner' && (
                                    <span className="px-3 py-1 text-sm text-gray-500">不可修改</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 text-sm">暂无权限记录</p>
            )}
        </div>
    );
}

