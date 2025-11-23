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

type FilterState = typeof FILTER_DEFAULTS;

export function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [filterForm, setFilterForm] = useState<FilterState>({ ...FILTER_DEFAULTS });
    const [filters, setFilters] = useState<FilterState>({ ...FILTER_DEFAULTS });

    const isFilterActive = useMemo(() => {
        return (
            filters.type !== FILTER_DEFAULTS.type ||
            filters.docId.trim() !== FILTER_DEFAULTS.docId ||
            filters.startDate !== FILTER_DEFAULTS.startDate ||
            filters.endDate !== FILTER_DEFAULTS.endDate ||
            filters.unreadOnly !== FILTER_DEFAULTS.unreadOnly
        );
    }, [filters]);

    const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

    useEffect(() => {
        if (page > pageCount) {
            setPage(pageCount);
        }
    }, [page, pageCount]);

    const buildParams = useCallback(
        (inputFilters: FilterState, currentPage: number): NotificationFilterParams => {
            const params: NotificationFilterParams = {
                page: currentPage,
                page_size: pageSize,
                unread_only: inputFilters.unreadOnly || undefined,
                type: inputFilters.type || undefined,
            };
            
            // 处理开始日期：转换为 ISO 8601 格式（如果提供了日期）
            if (inputFilters.startDate) {
                // 将 YYYY-MM-DD 格式转换为 ISO 8601 格式（开始时间：00:00:00）
                params.start_date = `${inputFilters.startDate}T00:00:00Z`;
            }
            
            // 处理结束日期：转换为 ISO 8601 格式（如果提供了日期）
            if (inputFilters.endDate) {
                // 将 YYYY-MM-DD 格式转换为 ISO 8601 格式（结束时间：23:59:59）
                params.end_date = `${inputFilters.endDate}T23:59:59Z`;
            }
            
            // 处理文档ID
            if (inputFilters.docId.trim()) {
                const docId = Number(inputFilters.docId);
                if (!Number.isNaN(docId) && docId > 0) {
                    params.doc_id = docId;
                }
            }
            
            return params;
        },
        [pageSize]
    );

    const fetchNotifications = useCallback(
        async (inputFilters: FilterState = filters, inputPage = page) => {
            try {
                setLoading(true);
                setError(null);
                const response = await apiClient.getNotifications(buildParams(inputFilters, inputPage));
                setNotifications(response.notifications || []);
                setTotal(response.total || 0);
                setSelected(new Set());
            } catch (err: any) {
                console.error('Failed to load notifications:', err);
                setError(err.response?.data?.error || '加载通知失败');
            } finally {
                setLoading(false);
            }
        },
        [buildParams]
    );

    // 初始加载和当 filters 或 page 改变时自动获取数据
    useEffect(() => {
        fetchNotifications(filters, page);
    }, [fetchNotifications, filters, page]);

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextFilters: FilterState = { ...filterForm };
        setFilters(nextFilters);
        setPage(1);
        // useEffect 会在 filters 或 page 改变时自动调用 fetchNotifications
    };

    const resetFilters = () => {
        const next = { ...FILTER_DEFAULTS };
        setFilterForm(next);
        setFilters(next);
        setPage(1);
        // useEffect 会在 filters 或 page 改变时自动调用 fetchNotifications
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
                                            {isFilterActive ? (
                                                <div className="space-y-3">
                                                    <p>没有符合当前筛选条件的通知</p>
                                                    <button
                                                        type="button"
                                                        onClick={resetFilters}
                                                        className="text-sm px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition"
                                                    >
                                                        清除筛选条件
                                                    </button>
                                                </div>
                                            ) : (
                                                '暂无通知'
                                            )}
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
                            onClick={() => {
                                const newPage = Math.max(1, page - 1);
                                setPage(newPage);
                                // useEffect 会在 page 改变时自动调用 fetchNotifications
                            }}
                            disabled={page <= 1}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                            上一页
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const newPage = Math.min(pageCount, page + 1);
                                setPage(newPage);
                                // useEffect 会在 page 改变时自动调用 fetchNotifications
                            }}
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


