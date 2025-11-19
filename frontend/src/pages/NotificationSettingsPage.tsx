import { useEffect, useMemo, useState } from 'react';
import apiClient from '../api/client';
import { NotificationSetting, UpdateNotificationSettingRequest } from '../types';

const NOTIFICATION_GROUPS = [
    {
        type: 'comment',
        title: '评论提醒',
        description: '当协作者在文档中发表评论时通知我',
    },
    {
        type: 'task_assigned',
        title: '任务分配',
        description: '当有任务分配给我或我负责的成员时提醒我',
    },
    {
        type: 'task_status_changed',
        title: '任务状态变更',
        description: '任务状态更新或完成时通知我',
    },
    {
        type: 'permission_changed',
        title: '权限变更',
        description: '当我拥有的文档权限发生调整时提醒我',
    },
];

const DEFAULT_SETTING: Omit<NotificationSetting, 'notification_type'> = {
    email_enabled: true,
    push_enabled: true,
    in_app_enabled: true,
};

type SettingField = keyof UpdateNotificationSettingRequest;

export function NotificationSettingsPage() {
    const [settings, setSettings] = useState<Record<string, NotificationSetting>>({});
    const [loading, setLoading] = useState(true);
    const [savingType, setSavingType] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [browserPermission, setBrowserPermission] = useState<
        NotificationPermission | 'unsupported'
    >(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');

    const loadSettings = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.getNotificationSettings();
            const map: Record<string, NotificationSetting> = {};
            response.forEach((item) => {
                map[item.notification_type] = item;
            });
            setSettings(map);
        } catch (err: any) {
            console.error('Failed to load notification settings:', err);
            setError(err.response?.data?.error || '加载通知设置失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const effectiveSettings = useMemo(() => settings, [settings]);

    const resolveSetting = (type: string): NotificationSetting =>
        effectiveSettings[type] ?? {
            notification_type: type,
            ...DEFAULT_SETTING,
        };

    const handleToggle = async (type: string, field: SettingField, value: boolean) => {
        try {
            setSavingType(type);
            await apiClient.updateNotificationSetting(type, { [field]: value });
            setSettings((prev) => ({
                ...prev,
                [type]: {
                    ...resolveSetting(type),
                    [field]: value,
                },
            }));
        } catch (err) {
            console.error('Failed to update notification setting:', err);
            alert('更新设置失败，请稍后再试');
        } finally {
            setSavingType(null);
        }
    };

    const handleRequestPermission = async () => {
        if (browserPermission === 'unsupported' || !('Notification' in window)) return;
        try {
            const permission = await Notification.requestPermission();
            setBrowserPermission(permission);
        } catch (err) {
            console.error('Failed to request browser notification permission:', err);
        }
    };

    const buttonClasses = (active: boolean) =>
        `px-4 py-2 text-sm rounded-lg border transition ${
            active ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-white'
        }`;

    return (
        <div className="font-inter bg-gray-50 min-h-screen py-10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">通知设置</h1>
                        <p className="text-sm text-gray-500 mt-1">为不同情境选择合适的提醒渠道</p>
                    </div>
                    {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
                        <button
                            onClick={handleRequestPermission}
                            className="px-4 py-2 text-sm font-medium border border-primary text-primary rounded-lg hover:bg-primary/5"
                        >
                            开启浏览器推送
                        </button>
                    )}
                </div>

                {error && (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    {loading ? (
                        <div className="py-12 text-center text-gray-400">
                            <i className="fa fa-spinner fa-spin text-2xl"></i>
                            <p className="mt-3 text-sm">正在加载通知设置...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {NOTIFICATION_GROUPS.map((group) => {
                                const setting = resolveSetting(group.type);
                                const disabled = savingType === group.type;
                                return (
                                    <div
                                        key={group.type}
                                        className="p-4 border border-gray-100 rounded-2xl hover:border-primary/30 transition"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-semibold text-gray-900">{group.title}</h3>
                                                <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() =>
                                                        handleToggle(group.type, 'in_app_enabled', !setting.in_app_enabled)
                                                    }
                                                    className={`${buttonClasses(setting.in_app_enabled)} disabled:opacity-50`}
                                                >
                                                    站内提醒
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() =>
                                                        handleToggle(group.type, 'push_enabled', !setting.push_enabled)
                                                    }
                                                    className={`${buttonClasses(setting.push_enabled)} disabled:opacity-50`}
                                                >
                                                    推送提醒
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() =>
                                                        handleToggle(group.type, 'email_enabled', !setting.email_enabled)
                                                    }
                                                    className={`${buttonClasses(setting.email_enabled)} disabled:opacity-50`}
                                                >
                                                    邮件提醒
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


