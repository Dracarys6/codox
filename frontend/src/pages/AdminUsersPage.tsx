import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import {
    AdminUser,
    AdminUserListParams,
    FeedbackStatsResponse,
    UserAnalyticsResponse,
} from '../types';
import { toast } from '../components/ui/Toast';
import { Layout } from '../components/Layout';

type AdminTab = 'users' | 'analytics' | 'feedback';

const ROLE_OPTIONS = [
    { label: '全部角色', value: '' },
    { label: '管理员', value: 'admin' },
    { label: '编辑者', value: 'editor' },
    { label: '查看者', value: 'viewer' },
];

const STATUS_OPTIONS = [
    { label: '全部状态', value: '' },
    { label: '正常', value: 'active' },
    { label: '禁用', value: 'disabled' },
    { label: '冻结', value: 'suspended' },
];

const SORT_OPTIONS = [
    { label: '注册时间', value: 'created_at' },
    { label: '最近登录', value: 'last_login_at' },
    { label: '文档数', value: 'document_count' },
    { label: '评论数', value: 'comment_count' },
    { label: '任务完成数', value: 'completed_tasks' },
];

export function AdminUsersPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<AdminTab>('users');

    if (!user) {
        return null;
    }

    if (user.role !== 'admin') {
        return <Navigate to="/home" replace />;
    }

    return (
        <Layout>
            <div className="space-y-8">
                <header className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-blue-600 uppercase">Admin Center</p>
                        <h1 className="text-3xl font-bold text-slate-900 mt-1">用户与运营管理</h1>
                        <p className="text-slate-500 mt-1 text-sm">
                            管理账号、调整权限、洞察活跃趋势，并收集用户满意度。
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white shadow-lg">
                        <div>
                            <p className="text-xs uppercase text-white/70">当前身份</p>
                            <p className="text-lg font-semibold">系统管理员</p>
                        </div>
                        <svg className="h-10 w-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </header>

                <div className="flex gap-2 border-b border-slate-200">
                    {[
                        { key: 'users', label: '用户列表' },
                        { key: 'analytics', label: '行为分析' },
                        { key: 'feedback', label: '满意度反馈' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key as AdminTab)}
                            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-white border border-b-white border-slate-200 text-blue-600'
                                    : 'text-slate-500 hover:text-blue-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'users' && <UserListPanel />}
                {activeTab === 'analytics' && <UserAnalyticsPanel />}
                {activeTab === 'feedback' && <FeedbackStatsPanel />}
            </div>
        </Layout>
    );
}

function UserListPanel() {
    const pageSize = 15;
    const [filters, setFilters] = useState<AdminUserListParams>({
        page: 1,
        page_size: pageSize,
        sort_by: 'created_at',
        sort_order: 'desc',
    });
    const [keyword, setKeyword] = useState('');
    const debouncedKeyword = useDebounce(keyword, 400);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        setFilters((prev) => {
            const nextKeyword = debouncedKeyword.trim();
            const normalizedKeyword = nextKeyword.length > 0 ? nextKeyword : undefined;
            if (prev.keyword === normalizedKeyword && prev.page === 1) {
                return prev;
            }
            return {
                ...prev,
                page: 1,
                keyword: normalizedKeyword,
            };
        });
    }, [debouncedKeyword]);

    useEffect(() => {
        let isMounted = true;
        async function fetchUsers() {
            setIsLoading(true);
            try {
                const response = await apiClient.getAdminUsers(filters);
                if (!isMounted) return;
                setUsers(response.users);
                setTotal(response.total);
            } catch (error: any) {
                toast.error(error?.response?.data?.error || '加载用户列表失败');
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        fetchUsers();
        return () => {
            isMounted = false;
        };
    }, [filters]);

    const totalPages = Math.max(1, Math.ceil(total / (filters.page_size || pageSize)));

    const aggregate = useMemo(() => {
        if (!users.length) {
            return {
                active: 0,
                locked: 0,
                avgDocs: 0,
            };
        }
        const active = users.filter((user) => user.status === 'active').length;
        const locked = users.filter((user) => user.is_locked).length;
        const avgDocs =
            users.reduce((sum, user) => sum + (user.stats?.document_count || 0), 0) / users.length;
        return {
            active,
            locked,
            avgDocs: Math.round(avgDocs * 10) / 10,
        };
    }, [users]);

    const handleFilterChange = (patch: Partial<AdminUserListParams>) => {
        setFilters((prev) => ({
            ...prev,
            page: 1,
            ...patch,
        }));
    };

    const handlePageChange = (page: number) => {
        setFilters((prev) => ({
            ...prev,
            page,
        }));
    };

    const replaceUser = (updated: AdminUser) => {
        setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
    };

    const handleStatusUpdate = async (userId: number, patch: { status?: string; is_locked?: boolean }) => {
        setUpdatingUserId(userId);
        try {
            const response = await apiClient.updateAdminUser(userId, patch);
            replaceUser(response.user);
            toast.success('用户状态已更新');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || '更新状态失败');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleRoleUpdate = async (userId: number, role: string) => {
        setUpdatingUserId(userId);
        try {
            const response = await apiClient.updateAdminUserRoles(userId, role);
            replaceUser(response.user);
            toast.success('角色已更新');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || '更新角色失败');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await apiClient.exportAdminUsers(filters);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('导出成功');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || '导出失败');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">激活账号</p>
                    <p className="text-3xl font-semibold text-slate-900 mt-1">{aggregate.active}</p>
                    <p className="text-xs text-slate-400 mt-1">当前列表中状态为 Active 的用户数量</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">安全冻结</p>
                    <p className="text-3xl font-semibold text-rose-600 mt-1">{aggregate.locked}</p>
                    <p className="text-xs text-slate-400 mt-1">被锁定或风控的账号数量</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">平均文档数</p>
                    <p className="text-3xl font-semibold text-emerald-600 mt-1">{aggregate.avgDocs}</p>
                    <p className="text-xs text-slate-400 mt-1">当前列表中人均拥有的文档数量</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-2">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-4.15a6 6 0 11-12 0 6 6 0 0112 0z" />
                        </svg>
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="按邮箱 / 昵称 / 手机号搜索"
                            className="flex-1 bg-transparent text-sm focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={filters.role || ''}
                            onChange={(e) => handleFilterChange({ role: e.target.value || undefined })}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                            {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={filters.status || ''}
                            onChange={(e) => handleFilterChange({ status: e.target.value || undefined })}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={filters.sort_by || 'created_at'}
                            onChange={(e) => handleFilterChange({ sort_by: e.target.value as AdminUserListParams['sort_by'] })}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {`排序：${option.label}`}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() =>
                                handleFilterChange({
                                    sort_order: filters.sort_order === 'desc' ? 'asc' : 'desc',
                                })
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                            {filters.sort_order === 'desc' ? '降序' : '升序'}
                        </button>

                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={exporting}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-blue-500/30 shadow disabled:opacity-70"
                        >
                            {exporting ? (
                                <i className="fa fa-spinner fa-spin" />
                            ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16h16M7 10l5 5 5-5M12 15V4" />
                                </svg>
                            )}
                            导出
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">用户</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">角色/状态</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">互动数据</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">最后登录</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">备注</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                        <i className="fa fa-spinner fa-spin mr-2" />
                                        正在加载用户数据...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                        暂无匹配的用户记录
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold">
                                                    {(user.profile?.nickname || user.email).charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{user.profile?.nickname || '未设置昵称'}</p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 space-y-2">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleUpdate(user.id, e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                                                disabled={updatingUserId === user.id}
                                            >
                                                {ROLE_OPTIONS.filter((option) => option.value).map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={user.status}
                                                onChange={(e) => handleStatusUpdate(user.id, { status: e.target.value })}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                                                disabled={updatingUserId === user.id}
                                            >
                                                {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={user.is_locked}
                                                    onChange={(e) => handleStatusUpdate(user.id, { is_locked: e.target.checked })}
                                                    disabled={updatingUserId === user.id}
                                                />
                                                锁定
                                            </label>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <p>文档：{user.stats?.document_count ?? 0}</p>
                                                <p>评论：{user.stats?.comment_count ?? 0}</p>
                                                <p>任务：{user.stats?.completed_tasks ?? 0}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-xs text-slate-500">
                                            {user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN') : '未登录'}
                                        </td>
                                        <td className="px-4 py-4 text-xs text-slate-500 max-w-[160px] break-words">
                                            {user.remark || '—'}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {updatingUserId === user.id ? (
                                                <span className="text-xs text-blue-500">更新中...</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-500"
                                                    onClick={() =>
                                                        toast.info(
                                                            `文档：${user.stats?.document_count ?? 0}，近 30 天活跃：${
                                                                user.stats?.active_document_count ?? 0
                                                            }`
                                                        )
                                                    }
                                                >
                                                    查看详情
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                <p>
                    共 {total} 个结果 · 第 {filters.page} / {totalPages} 页
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => handlePageChange(Math.max(1, (filters.page || 1) - 1))}
                        disabled={(filters.page || 1) <= 1}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-60"
                    >
                        上一页
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePageChange(Math.min(totalPages, (filters.page || 1) + 1))}
                        disabled={(filters.page || 1) >= totalPages}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-60"
                    >
                        下一页
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
}

type RangePreset = 'days7' | 'days30' | 'days90';
const RANGE_OPTIONS: Array<{ key: RangePreset; label: string; days: number }> = [
    { key: 'days7', label: '近 7 天', days: 7 },
    { key: 'days30', label: '近 30 天', days: 30 },
    { key: 'days90', label: '近 90 天', days: 90 },
];

function UserAnalyticsPanel() {
    const [range, setRange] = useState<RangePreset>('days30');
    const [analytics, setAnalytics] = useState<UserAnalyticsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadAnalytics = async (selectedRange: RangePreset) => {
        setIsLoading(true);
        const now = new Date();
        const days = RANGE_OPTIONS.find((option) => option.key === selectedRange)?.days ?? 30;
        const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        try {
            const response = await apiClient.getUserAnalytics({
                from: fromDate.toISOString(),
                to: now.toISOString(),
                limit: 8,
            });
            setAnalytics(response);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || '加载分析数据失败');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics(range);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600 uppercase">Team Pulse</p>
                    <h2 className="text-2xl font-bold text-slate-900 mt-1">活跃度与贡献度走势</h2>
                </div>
                <div className="flex gap-2">
                    {RANGE_OPTIONS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setRange(item.key)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                range === item.key
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'bg-white border border-slate-200 text-slate-600'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                    <i className="fa fa-spinner fa-spin mr-2" />
                    正在加载趋势数据...
                </div>
            ) : !analytics ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-400">
                    暂无数据
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <AnalyticsCard label="新增文档" value={analytics.totals.documents_created} badge="+ 文档" />
                        <AnalyticsCard label="新增评论" value={analytics.totals.comments_created} badge="+ 评论" />
                        <AnalyticsCard label="完成任务" value={analytics.totals.tasks_completed} badge="+ 任务" />
                        <AnalyticsCard label="活跃用户" value={analytics.totals.active_users} badge="活跃" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-5 py-4">
                                <h3 className="text-base font-semibold text-slate-900">贡献度 TOP 用户</h3>
                                <p className="text-xs text-slate-500">按文档 + 评论 + 任务完成量排序</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {analytics.top_users.length === 0 ? (
                                    <p className="px-5 py-6 text-xs text-slate-400">暂无活跃用户</p>
                                ) : (
                                    analytics.top_users.map((item) => (
                                        <div key={item.user_id} className="flex items-center justify-between px-5 py-4">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{item.nickname || item.email}</p>
                                                <p className="text-xs text-slate-400">{item.email}</p>
                                            </div>
                                            <div className="flex gap-6 text-xs text-slate-500">
                                                <span>文档 {item.documents_created}</span>
                                                <span>评论 {item.comments_created}</span>
                                                <span>任务 {item.tasks_completed}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-5 py-4">
                                <h3 className="text-base font-semibold text-slate-900">角色维度贡献</h3>
                                <p className="text-xs text-slate-500">帮助评估各角色的活跃度</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {analytics.role_breakdown.length === 0 ? (
                                    <p className="px-5 py-6 text-xs text-slate-400">暂无数据</p>
                                ) : (
                                    analytics.role_breakdown.map((item) => (
                                        <div key={item.role} className="flex items-center justify-between px-5 py-4 text-sm text-slate-600">
                                            <span className="font-semibold text-slate-900">
                                                {item.role === 'admin' ? '管理员' : item.role === 'editor' ? '编辑者' : '查看者'}
                                            </span>
                                            <div className="flex gap-4 text-xs text-slate-500">
                                                <span>文档 {item.documents_created}</span>
                                                <span>评论 {item.comments_created}</span>
                                                <span>任务 {item.tasks_completed}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function AnalyticsCard({ label, value, badge }: { label: string; value: number; badge: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
                <p className="text-3xl font-semibold text-slate-900">{value}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{badge}</span>
            </div>
        </div>
    );
}

function FeedbackStatsPanel() {
    const [dimension, setDimension] = useState('');
    const [stats, setStats] = useState<FeedbackStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function loadStats() {
            setIsLoading(true);
            try {
                const response = await apiClient.getFeedbackStats(
                    dimension ? { dimension } : undefined
                );
                if (isMounted) {
                    setStats(response);
                }
            } catch (error: any) {
                toast.error(error?.response?.data?.error || '加载反馈统计失败');
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        loadStats();
        return () => {
            isMounted = false;
        };
    }, [dimension]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600 uppercase">Voice of users</p>
                    <h2 className="text-2xl font-bold text-slate-900 mt-1">满意度与最新反馈</h2>
                </div>
                <select
                    value={dimension}
                    onChange={(e) => setDimension(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                >
                    <option value="">全部维度</option>
                    <option value="overall">整体体验</option>
                    <option value="collaboration">协作效率</option>
                    <option value="editor">编辑体验</option>
                    <option value="notification">通知提醒</option>
                </select>
            </div>

            {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                    <i className="fa fa-spinner fa-spin mr-2" />
                    正在加载反馈数据...
                </div>
            ) : !stats ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-400">
                    暂无反馈
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {stats.summary.length === 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                                尚未收到反馈
                            </div>
                        ) : (
                            stats.summary.map((item) => (
                                <div key={item.dimension} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <p className="text-sm text-slate-500">{item.dimension}</p>
                                    <p className="mt-2 text-3xl font-semibold text-slate-900">{item.avg_score}</p>
                                    <p className="text-xs text-slate-400 mt-1">{item.responses} 条反馈</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h3 className="text-base font-semibold text-slate-900">最新反馈</h3>
                            <p className="text-xs text-slate-500">最近 20 条用户心声</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {stats.recent.length === 0 ? (
                                <p className="px-5 py-6 text-sm text-slate-400">暂无反馈</p>
                            ) : (
                                stats.recent.map((item) => (
                                    <div key={item.id} className="px-5 py-4 text-sm text-slate-700">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-900">
                                                    {item.nickname || item.email}
                                                </p>
                                                <p className="text-xs text-slate-400">{item.dimension}</p>
                                            </div>
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                                                {item.score} 分
                                            </span>
                                        </div>
                                        {item.comment && (
                                            <p className="mt-2 text-slate-600 text-sm leading-snug">{item.comment}</p>
                                        )}
                                        <p className="mt-2 text-xs text-slate-400">
                                            {new Date(item.created_at).toLocaleString('zh-CN')}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


