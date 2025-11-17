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
            <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm font-medium text-gray-600">加载权限信息中...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">访问控制列表</h3>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-shake">
                    <svg className="w-3 h-3 min-w-[0.75rem]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* 添加新权限 */}
            <div className="p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200/50 shadow-sm">
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="icon-sm text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    添加用户权限
                </h4>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="number"
                        value={newUserId}
                        onChange={(e) => setNewUserId(e.target.value)}
                        placeholder="用户ID"
                        className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white transition-all duration-200 text-sm placeholder:text-gray-400"
                    />
                    <select
                        value={newPermission}
                        onChange={(e) => setNewPermission(e.target.value as 'editor' | 'viewer')}
                        className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white transition-all duration-200 text-sm font-medium"
                    >
                        <option value="editor">✏️ 编辑者</option>
                        <option value="viewer">👁️ 查看者</option>
                    </select>
                    <button
                        onClick={handleAddAcl}
                        disabled={saving || !newUserId.trim()}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <svg className="animate-spin icon-sm" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                处理中...
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3 min-w-[0.75rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                添加
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 权限列表 */}
            {acl && acl.acl.length > 0 ? (
                <div className="space-y-3">
                    {acl.acl.map((entry, idx) => (
                        <div
                            key={idx}
                            className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white/80 rounded-2xl border-2 border-gray-200/60 hover:border-blue-300/50 transition-all duration-300 hover:shadow-md"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                                    {entry.user_id}
                                </div>
                                <div>
                                    <span className="text-gray-900 font-semibold block">用户 {entry.user_id}</span>
                                    {entry.permission === 'owner' && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full border border-purple-200/50 mt-1">
                                            <svg className="w-3 h-3 min-w-[0.75rem]" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            所有者
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {entry.permission !== 'owner' ? (
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
                                            className="px-4 py-2 text-sm font-medium border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white transition-all duration-200"
                                        >
                                            <option value="editor">✏️ 编辑者</option>
                                            <option value="viewer">👁️ 查看者</option>
                                        </select>
                                        <button
                                            onClick={() => handleRemoveAcl(entry.user_id)}
                                            disabled={saving}
                                            className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border-2 border-red-200 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                        >
                                            <svg className="w-3 h-3 min-w-[0.75rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            移除
                                        </button>
                                    </>
                                ) : (
                                    <span className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl border-2 border-gray-200">
                                        🔒 不可修改
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50/50 rounded-2xl border-2 border-gray-200/50">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-500 font-medium text-sm">暂无权限记录</p>
                    <p className="text-gray-400 text-xs mt-1">添加用户以开始协作</p>
                </div>
            )}
        </div>
    );
}

