import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { NotificationItem } from '../types';
import { useNotificationWebSocket } from '../hooks/useNotificationWebSocket';

export function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showPanel, setShowPanel] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [latestToast, setLatestToast] = useState<NotificationItem | null>(null);
    const toastTimerRef = useRef<number | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [browserPermission, setBrowserPermission] = useState<
        NotificationPermission | 'unsupported'
    >(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');

    const loadUnreadCount = useCallback(async () => {
        try {
            const response = await apiClient.getUnreadNotificationCount();
            setUnreadCount(response.unread_count || 0);
        } catch (err) {
            console.error('Failed to load unread count:', err);
        }
    }, []);

    const loadNotifications = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await apiClient.getNotifications({ page: 1, page_size: 20 });
            setNotifications(response.notifications || []);
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [loadUnreadCount]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setShowPanel(false);
            }
        };

        if (showPanel) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPanel]);

    const handleMarkAsRead = async (notificationIds: number[]) => {
        try {
            await apiClient.markNotificationsAsRead(notificationIds);
            loadUnreadCount();
            loadNotifications();
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const handleTogglePanel = () => {
        if (!showPanel) {
            loadNotifications();
        }
        setShowPanel((prev) => !prev);
    };

    const handleRequestPermission = async () => {
        if (browserPermission === 'unsupported' || !('Notification' in window)) return;
        try {
            const permission = await Notification.requestPermission();
            setBrowserPermission(permission);
        } catch (err) {
            console.error('Request notification permission failed:', err);
        }
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

    const getNotificationBody = (notification: NotificationItem) => {
        const { payload } = notification;
        if (payload?.doc_title) return payload.doc_title;
        if (payload?.task_title) return payload.task_title;
        return '点击查看详情';
    };

    const getNotificationLink = (notification: NotificationItem) => {
        const { payload } = notification;
        if (payload.doc_id) {
            return `/editor/${payload.doc_id}`;
        }
        return '/documents';
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return date.toLocaleDateString('zh-CN');
    };

    const showBrowserNotification = useCallback(
        (notification: NotificationItem) => {
            if (browserPermission !== 'granted' || !('Notification' in window)) return;
            const title = getNotificationText(notification);
            const body = getNotificationBody(notification);
            try {
                new Notification(title, {
                    body,
                    tag: `notification-${notification.id}`,
                    icon: '/icon-192.png',
                });
            } catch (err) {
                console.error('Failed to show browser notification:', err);
            }
        },
        [browserPermission]
    );

    const handleIncomingNotification = useCallback(
        (notification: NotificationItem) => {
            setNotifications((prev) => {
                if (prev.some((item) => item.id === notification.id)) {
                    return prev;
                }
                return [notification, ...prev].slice(0, 20);
            });
            if (!notification.is_read) {
                setUnreadCount((count) => count + 1);
                showBrowserNotification(notification);
            }
            setLatestToast(notification);
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
            toastTimerRef.current = window.setTimeout(() => {
                setLatestToast(null);
            }, 5000);
        },
        [showBrowserNotification]
    );

    useNotificationWebSocket({
        onNotification: (notification) => {
            handleIncomingNotification(notification);
            loadUnreadCount();
        },
    });

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    const unreadNotifications = notifications.filter((n) => !n.is_read);

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={handleTogglePanel}
                className="relative p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-custom"
                title="通知"
            >
                <i className="fa fa-bell-o text-xl"></i>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-danger border-2 border-white"></span>
                )}
            </button>

            {showPanel && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">通知</h3>
                            <div className="flex items-center gap-2">
                                {unreadNotifications.length > 0 && (
                                    <button
                                        onClick={() => handleMarkAsRead(unreadNotifications.map((n) => n.id))}
                                        className="text-sm text-primary hover:text-primary/80 transition-custom"
                                    >
                                        全部标记为已读
                                    </button>
                                )}
                            </div>
                        </div>
                        {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
                            <button
                                onClick={handleRequestPermission}
                                className="mt-2 text-xs text-primary underline"
                            >
                                开启桌面通知
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-8 text-center">
                                <i className="fa fa-spinner fa-spin text-2xl text-gray-400"></i>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <i className="fa fa-bell-slash-o text-3xl mb-2"></i>
                                <p>暂无通知</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <Link
                                    key={notification.id}
                                    to={getNotificationLink(notification)}
                                    onClick={() => {
                                        if (!notification.is_read) {
                                            handleMarkAsRead([notification.id]);
                                        }
                                        setShowPanel(false);
                                    }}
                                    className={`block p-4 border-b border-gray-100 hover:bg-gray-50 transition-custom ${!notification.is_read ? 'bg-primary/5' : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                                {getNotificationText(notification)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatTime(notification.created_at)}
                                            </p>
                                        </div>
                                        {!notification.is_read && (
                                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1"></div>
                                        )}
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-200 text-center flex flex-col gap-1">
                            <Link
                                to="/notifications"
                                className="text-sm text-primary hover:text-primary/80 transition-custom"
                                onClick={() => setShowPanel(false)}
                            >
                                查看全部通知
                            </Link>
                        </div>
                    )}
                </div>
            )}
            {latestToast && (
                <div className="fixed bottom-6 right-6 w-80 bg-white shadow-2xl rounded-2xl border border-primary/30 z-50 animate-fade-in">
                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                <i className="fa fa-bell"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                    {getNotificationText(latestToast)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    刚刚 · {latestToast.type}
                                </p>
                            </div>
                            <button
                                onClick={() => setLatestToast(null)}
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="关闭提醒"
                            >
                                <i className="fa fa-times"></i>
                            </button>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                onClick={() => setLatestToast(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                            >
                                稍后处理
                            </button>
                            <Link
                                to={getNotificationLink(latestToast)}
                                className="text-xs px-3 py-1.5 rounded-full bg-primary text-white hover:bg-primary/90"
                                onClick={() => {
                                    setShowPanel(false);
                                    setLatestToast(null);
                                }}
                            >
                                查看详情
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


