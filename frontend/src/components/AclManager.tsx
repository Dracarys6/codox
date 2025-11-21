import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/client';
import { DocumentAcl, AclEntry, UpdateAclRequest } from '../types';

interface AclManagerProps {
    docId: number;
    onUpdate?: () => void;
    onLoaded?: (acl: DocumentAcl | null) => void;
    isOwner?: boolean;
}

const PERMISSION_INFO = {
    owner: {
        label: '所有者',
        icon: '👑',
        description: '拥有文档的完全控制权，可以编辑、删除文档并管理权限',
        color: 'from-purple-500 to-pink-500',
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-700',
        borderColor: 'border-purple-200',
    },
    editor: {
        label: '编辑者',
        icon: '✏️',
        description: '可以编辑文档内容，但不能删除文档或修改权限',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
    },
    viewer: {
        label: '查看者',
        icon: '👁️',
        description: '只能查看文档内容，不能进行编辑',
        color: 'from-gray-400 to-gray-500',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-200',
    },
};

export function AclManager({ docId, onUpdate, onLoaded, isOwner = true }: AclManagerProps) {
    const [acl, setAcl] = useState<DocumentAcl | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [newUserId, setNewUserId] = useState('');
    const [newPermission, setNewPermission] = useState<'editor' | 'viewer'>('editor');
    const [searchTerm, setSearchTerm] = useState('');
    const [forbidden, setForbidden] = useState(false);

    useEffect(() => {
        loadAcl();
    }, [docId]);

    // 自动清除成功消息
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const loadAcl = async () => {
        try {
            setLoading(true);
            setError(null);
            const aclData = await apiClient.getDocumentAcl(docId);
            setAcl(aclData);
            setForbidden(false);
            onLoaded?.(aclData);
        } catch (err: any) {
            if (err.response?.status === 403) {
                setForbidden(true);
                setError('仅文档所有者可以查看或管理权限');
            } else {
                setError(err.response?.data?.error || '加载权限列表失败');
            }
            console.error('Failed to load ACL:', err);
            onLoaded?.(null);
        } finally {
            setLoading(false);
        }
    };

    // 过滤权限列表
    const filteredAcl = useMemo(() => {
        if (!acl) return [];
        if (!searchTerm.trim()) return acl.acl;
        const term = searchTerm.toLowerCase();
        return acl.acl.filter((entry) => {
            const email = entry.email?.toLowerCase() || '';
            const nickname = entry.nickname?.toLowerCase() || '';
            const userId = entry.user_id.toString();
            return email.includes(term) || nickname.includes(term) || userId.includes(term);
        });
    }, [acl, searchTerm]);

    // 统计信息
    const stats = useMemo(() => {
        if (!acl) return { total: 0, owners: 0, editors: 0, viewers: 0 };
        return {
            total: acl.acl.length,
            owners: acl.acl.filter((e) => e.permission === 'owner').length,
            editors: acl.acl.filter((e) => e.permission === 'editor').length,
            viewers: acl.acl.filter((e) => e.permission === 'viewer').length,
        };
    }, [acl]);

    const canManage = isOwner && !forbidden;

    const handleAddAcl = async () => {
        if (!canManage) return;
        if (!newUserId.trim()) {
            setError('请输入用户ID');
            return;
        }

        const userId = parseInt(newUserId);
        if (isNaN(userId) || userId <= 0) {
            setError('用户ID必须是正整数');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

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
            setSuccess('权限添加成功');
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
        if (!canManage) return;
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const currentAcl = acl?.acl || [];
            const updatedAcl: UpdateAclRequest = {
                acl: currentAcl.map((entry) =>
                    entry.user_id === userId ? { ...entry, permission } : entry
                ),
            };

            await apiClient.updateDocumentAcl(docId, updatedAcl);
            setSuccess('权限更新成功');
            await loadAcl();
            onUpdate?.();
        } catch (err: any) {
            setError(err.response?.data?.error || '更新权限失败');
            console.error('Failed to update ACL:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveAcl = async (userId: number, userName: string) => {
        if (!canManage) return;
        if (!window.confirm(`确定要移除用户 "${userName}" 的权限吗？`)) {
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const currentAcl = acl?.acl || [];
            // 过滤掉要删除的用户，但保留owner
            const updatedAcl: UpdateAclRequest = {
                acl: currentAcl.filter(
                    (entry) => entry.user_id !== userId || entry.permission === 'owner'
                ),
            };

            await apiClient.updateDocumentAcl(docId, updatedAcl);
            setSuccess('权限移除成功');
            await loadAcl();
            onUpdate?.();
        } catch (err: any) {
            setError(err.response?.data?.error || '移除权限失败');
            console.error('Failed to remove ACL:', err);
        } finally {
            setSaving(false);
        }
    };

    const getDisplayName = (entry: AclEntry) => {
        if (entry.nickname) return entry.nickname;
        if (entry.email) return entry.email;
        return `用户 ${entry.user_id}`;
    };

    const getInitials = (entry: AclEntry) => {
        if (entry.nickname) return entry.nickname[0].toUpperCase();
        if (entry.email) return entry.email[0].toUpperCase();
        return entry.user_id.toString().slice(-1);
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                <p className="mt-4 text-sm font-medium text-gray-600">加载权限信息中...</p>
            </div>
        );
    }

    const ownerEntry = acl?.acl.find((entry) => entry.permission === 'owner');

    return (
        <div className="space-y-6 w-full min-w-0">
            {/* 标题和统计 */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full flex-shrink-0"></div>
                        <h3 className="text-xl font-bold text-gray-900 truncate">访问权限</h3>
                    </div>
                    {stats.total > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="px-2 py-1 bg-gray-100 rounded-full">
                                共 {stats.total} 人
                            </span>
                        </div>
                    )}
                </div>

                {/* 统计卡片 */}
                {stats.total > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                        <div className="px-3 py-2 bg-purple-50 rounded-lg border border-purple-100 min-w-0">
                            <div className="text-xs text-purple-600 font-medium">所有者</div>
                            <div className="text-lg font-bold text-purple-700">{stats.owners}</div>
                        </div>
                        <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-100 min-w-0">
                            <div className="text-xs text-blue-600 font-medium">编辑者</div>
                            <div className="text-lg font-bold text-blue-700">{stats.editors}</div>
                        </div>
                        <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 min-w-0">
                            <div className="text-xs text-gray-600 font-medium">查看者</div>
                            <div className="text-lg font-bold text-gray-700">{stats.viewers}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* 成功提示 */}
            {success && (
                <div className="bg-green-50 border-2 border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">{success}</span>
                </div>
            )}

            {/* 错误提示 */}
            {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* 搜索框 */}
            {acl && acl.acl.length > 0 && (
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜索用户（ID、邮箱、昵称）..."
                        className="w-full px-4 py-2.5 pl-10 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white transition-all duration-200 text-sm placeholder:text-gray-400"
                    />
                    <i className="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <i className="fa fa-times"></i>
                        </button>
                    )}
                </div>
            )}

            {/* 添加新权限 */}
            {ownerEntry && (
                <div className="p-5 bg-white rounded-2xl border-2 border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold flex items-center justify-center text-lg">
                            {getInitials(ownerEntry)}
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">文档所有者</p>
                            <p className="text-lg font-semibold text-gray-900">{getDisplayName(ownerEntry)}</p>
                            {ownerEntry.email && <p className="text-xs text-gray-500">{ownerEntry.email}</p>}
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        所有者始终拥有文档的完全控制权限，无法通过 ACL 面板移除。如需转移所有者，请在文档设置中完成。
                    </p>
                </div>
            )}

            {canManage ? (
                <div className="p-5 rounded-2xl border-2 bg-gradient-to-br from-blue-50/50 to-purple-50/50 border-blue-200/30 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <i className="fa fa-user-plus text-blue-600"></i>
                        添加用户权限
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <input
                                type="number"
                                value={newUserId}
                                onChange={(e) => setNewUserId(e.target.value)}
                                placeholder="输入用户ID"
                                min="1"
                                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white transition-all duration-200 text-sm placeholder:text-gray-400"
                                disabled={!canManage}
                            />
                        </div>
                        <select
                            value={newPermission}
                            onChange={(e) => setNewPermission(e.target.value as 'editor' | 'viewer')}
                            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white transition-all duration-200 text-sm font-medium"
                            disabled={!canManage}
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
                                    <i className="fa fa-spinner fa-spin"></i>
                                    添加中...
                                </>
                            ) : (
                                <>
                                    <i className="fa fa-plus"></i>
                                    添加
                                </>
                            )}
                        </button>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                        {newPermission === 'editor'
                            ? PERMISSION_INFO.editor.description
                            : PERMISSION_INFO.viewer.description}
                    </p>
                </div>
            ) : (
                <div className="p-5 rounded-2xl border-2 bg-gray-50 border-gray-200 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <i className="fa fa-lock text-gray-500"></i>
                        权限信息
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        只有文档所有者可以添加或修改协作者。您可以查看当前的协作者列表，如需调整请联系文档所有者。
                    </p>
                </div>
            )}

            {/* 权限列表 */}
            {acl && filteredAcl.length > 0 ? (
                <div className="space-y-3">
                    {filteredAcl.map((entry, idx) => {
                        const info = PERMISSION_INFO[entry.permission];
                        const displayName = getDisplayName(entry);
                        const initials = getInitials(entry);
                        const isOwner = entry.permission === 'owner';

                        return (
                        <div
                                key={`${entry.user_id}-${idx}`}
                                className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-md"
                        >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* 头像 */}
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0`}>
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-gray-900 font-semibold truncate">{displayName}</span>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold ${info.bgColor} ${info.textColor} rounded-full border ${info.borderColor}`}>
                                                <span>{info.icon}</span>
                                                {info.label}
                                            </span>
                                </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500">
                                            {entry.email && (
                                                <span className="truncate">
                                                    <i className="fa fa-envelope mr-1"></i>
                                                    {entry.email}
                                        </span>
                                    )}
                                            <span className="text-gray-400">ID: {entry.user_id}</span>
                                        </div>
                                        {isOwner && (
                                            <p className="mt-1 text-xs text-gray-400">{info.description}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {!isOwner && canManage ? (
                                    <>
                                        <select
                                            value={entry.permission}
                                            onChange={(e) =>
                                                handleUpdatePermission(
                                                    entry.user_id,
                                                    e.target.value as 'owner' | 'editor' | 'viewer'
                                                )
                                            }
                                            disabled={saving || !canManage}
                                                className="px-3 py-2 text-sm font-medium border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-200 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white transition-all duration-200"
                                        >
                                            <option value="editor">✏️ 编辑者</option>
                                            <option value="viewer">👁️ 查看者</option>
                                        </select>
                                        <button
                                                onClick={() => handleRemoveAcl(entry.user_id, displayName)}
                                            disabled={saving || !canManage}
                                                className="px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border-2 border-red-200 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                                title="移除权限"
                                        >
                                                <i className="fa fa-trash"></i>
                                                <span className="hidden sm:inline">移除</span>
                                        </button>
                                    </>
                                ) : (
                                        <div className="px-3 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center gap-2">
                                            <i className="fa fa-lock"></i>
                                            <span>{isOwner ? '所有者不可修改' : '仅所有者可修改'}</span>
                                        </div>
                                )}
                                </div>
                            </div>
                        );
                    })}
                        </div>
            ) : acl && acl.acl.length > 0 && searchTerm ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <i className="fa fa-search text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500 font-medium text-sm">未找到匹配的用户</p>
                    <button
                        onClick={() => setSearchTerm('')}
                        className="mt-2 text-xs text-primary hover:text-primary/80"
                    >
                        清除搜索
                    </button>
                </div>
            ) : (
                <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fa fa-users text-2xl text-gray-400"></i>
                    </div>
                    <p className="text-gray-600 font-medium text-sm mb-1">暂无协作者</p>
                    <p className="text-gray-400 text-xs">添加用户以开始协作</p>
                </div>
            )}
        </div>
    );
}
