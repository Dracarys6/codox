import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { NotificationFilterParams, NotificationItem } from '../types';

const NOTIFICATION_TYPES = [
    { value: '', label: '全部类型' },
    { value: 'comment', label: '评论提醒' },
    { value: 'task_assigned', label: '任务分配' },
    { value: 'task_status_changed', label: '任务状态变更' },
    { value: 'permission_changed', label: '权限变更' },
];

const FILTER_DEFAULTS = {
    type: '',
    docId: '',
    startDate: '',
    endDate: '',
    unreadOnly: false,
};

export function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [filterForm, setFilterForm] = useState({ ...FILTER_DEFAULTS });
    const [filters, setFilters] = useState({ ...FILTER_DEFAULTS });

    const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

    useEffect(() => {
        if (page > pageCount) {
            setPage(pageCount);
        }
    }, [page, pageCount]);

    const buildParams = useCallback((): NotificationFilterParams => {
        const params: NotificationFilterParams = {
            page,
            page_size: pageSize,
            unread_only: filters.unreadOnly || undefined,
            type: filters.type || undefined,
            start_date: filters.startDate || undefined,
            end_date: filters.endDate || undefined,
        };
        if (filters.docId.trim()) {
            const docId = Number(filters.docId);
            if (!Number.isNaN(docId)) {
                params.doc_id = docId;
            }
        }
        return params;
    }, [filters, page, pageSize]);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.getNotifications(buildParams());
            setNotifications(response.notifications || []);
            setTotal(response.total || 0);
            setSelected(new Set());
        } catch (err: any) {
            console.error('Failed to load notifications:', err);
            setError(err.response?.data?.error || '加载通知失败');
        } finally {
            setLoading(false);
        }
    }, [buildParams]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFilters({ ...filterForm });
        setPage(1);
    };

    const resetFilters = () => {
        const next = { ...FILTER_DEFAULTS };
        setFilterForm(next);
        setFilters(next);
        setPage(1);
    };

    const handleSelect = (id: number) => {
        setSelected((prev) => {
            const copy = new Set(prev);
            if (copy.has(id)) {
                copy.delete(id);
            } else {
                copy.add(id);
            }
            return copy;
        });
    };

    const isAllSelected = notifications.length > 0 && selected.size === notifications.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(notifications.map((n) => n.id)));
        }
    };

    const handleMarkAsRead = async (notificationIds: number[]) => {
        try {
            await apiClient.markNotificationsAsRead(notificationIds);
            await fetchNotifications();
        } catch (err) {
            console.error('Failed to mark notifications as read:', err);
        }
    };

    const markSelectedAsRead = async () => {
        if (selected.size === 0) return;
        try {
            await apiClient.markNotificationsAsRead(Array.from(selected));
            await fetchNotifications();
        } catch (err) {
            console.error('Failed to mark selected notifications as read:', err);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
        if (unreadIds.length === 0) return;
        try {
            await apiClient.markNotificationsAsRead(unreadIds);
            await fetchNotifications();
        } catch (err) {
            console.error('Failed to mark all notifications as read:', err);
        }
    };

    const renderStatusTag = (notification: NotificationItem) =>
        notification.is_read ? (
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">已读</span>
        ) : (
            <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">未读</span>
        );

    const renderTypeLabel = (type: string) => {
        const mapping: Record<string, string> = {
            comment: '评论',
            task_assigned: '任务分配',
            task_status_changed: '任务变更',
            permission_changed: '权限变更',
        };
        return mapping[type] || type;
    };

    const getNotificationText = (notification: NotificationItem) => {
        const { type, payload } = notification;
        switch (type) {
            case 'comment':
                return `新评论: ${payload.comment_content || '有新的评论'}`;
            case 'task_assigned':
                return `任务分配: ${payload.task_title || '您有新的任务'}`;
            case 'task_status_changed':
                return `任务状态变更: ${payload.task_title || '任务状态已更新'}`;
            case 'permission_changed':
                return `权限变更: ${payload.message || '您的文档权限已更新'}`;
            default:
                return '新通知';
        }
    };

    const getNotificationLink = (notification: NotificationItem) => {
        const docId = notification.payload?.doc_id;
        if (docId) {
            return `/editor/${docId}`;
        }
        return '/documents';
    };

    const formatDateTime = (value: string) =>
        new Intl.DateTimeFormat('zh-CN', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value));

    return (
        <div className="font-inter bg-gray-50 min-h-screen py-10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">通知中心</h1>
                        <p className="text-sm text-gray-500 mt-1">筛选、查看并管理系统通知</p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to="/notifications/settings"
                            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-white transition"
                        >
                            通知设置
                        </Link>
                        <button
                            type="button"
                            onClick={markAllAsRead}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition"
                        >
                            全部标记已读
                        </button>
                    </div>
                </div>

                <form
                    onSubmit={handleFilterSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4"
                >
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">类型</label>
                            <select
                                value={filterForm.type}
                                onChange={(e) => setFilterForm((prev) => ({ ...prev, type: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            >
                                {NOTIFICATION_TYPES.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">关联文档ID</label>
                            <input
                                type="text"
                                value={filterForm.docId}
                                onChange={(e) => setFilterForm((prev) => ({ ...prev, docId: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                placeholder="例如 101"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">开始日期</label>
                            <input
                                type="date"
                                value={filterForm.startDate}
                                onChange={(e) => setFilterForm((prev) => ({ ...prev, startDate: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">结束日期</label>
                            <input
                                type="date"
                                value={filterForm.endDate}
                                onChange={(e) => setFilterForm((prev) => ({ ...prev, endDate: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex flex-col justify-end">
                            <label className="inline-flex items-center text-sm text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={filterForm.unreadOnly}
                                    onChange={(e) => setFilterForm((prev) => ({ ...prev, unreadOnly: e.target.checked }))}
                                    className="mr-2"
                                />
                                仅显示未读
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            重置
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90"
                        >
                            应用筛选
                        </button>
                    </div>
                </form>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm text-gray-500">
                            共 <span className="font-semibold text-gray-900">{total}</span> 条通知
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                {isAllSelected ? '取消全选' : '全选本页'}
                            </button>
                            <button
                                type="button"
                                onClick={markSelectedAsRead}
                                disabled={selected.size === 0}
                                className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                            >
                                标记所选已读
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                                        <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} />
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">类型</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">内容</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">时间</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">状态</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                                            <i className="fa fa-spinner fa-spin text-xl"></i>
                                        </td>
                                    </tr>
                                ) : notifications.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                                            暂无通知
                                        </td>
                                    </tr>
                                ) : (
                                    notifications.map((notification) => (
                                        <tr key={notification.id} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(notification.id)}
                                                    onChange={() => handleSelect(notification.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {renderTypeLabel(notification.type)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-800">
                                                <div className="font-medium">{getNotificationText(notification)}</div>
                                                {notification.payload?.doc_id && (
                                                    <Link
                                                        to={`/editor/${notification.payload.doc_id}`}
                                                        className="text-xs text-primary hover:underline"
                                                    >
                                                        前往文档
                                                    </Link>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {formatDateTime(notification.created_at)}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{renderStatusTag(notification)}</td>
                                            <td className="px-4 py-3 text-right text-sm space-x-3">
                                                {!notification.is_read && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkAsRead([notification.id])}
                                                        className="text-primary hover:text-primary/80"
                                                    >
                                                        标记已读
                                                    </button>
                                                )}
                                                <Link
                                                    to={getNotificationLink(notification)}
                                                    className="text-gray-500 hover:text-gray-700"
                                                >
                                                    查看
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-gray-500">
                        第 {page} / {pageCount} 页
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                            上一页
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                            disabled={page >= pageCount}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


