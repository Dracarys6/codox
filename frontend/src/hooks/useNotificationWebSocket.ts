import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationItem } from '../types';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface UseNotificationWebSocketOptions {
    onNotification?: (notification: NotificationItem) => void;
    onError?: (error: Event) => void;
}

export function useNotificationWebSocket({ onNotification, onError }: UseNotificationWebSocketOptions = {}) {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<number | null>(null);

    const buildWebSocketUrl = useCallback(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            return null;
        }

        const configured = (import.meta.env.VITE_NOTIFICATION_WS_URL as string | undefined)?.trim();
        if (configured) {
            const target = new URL(configured, window.location.origin);
            if (!target.searchParams.has('token')) {
                target.searchParams.set('token', token);
            }
            return target.toString();
        }

        const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
        let origin: string;
        if (apiBase && /^https?:\/\//i.test(apiBase)) {
            origin = new URL(apiBase).origin;
        } else if (import.meta.env.DEV) {
            origin = 'http://localhost:8080';
        } else {
            origin = window.location.origin;
        }

        const baseUrl = new URL('/ws/notifications', origin);
        baseUrl.searchParams.set('token', token);
        baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        return baseUrl.toString();
    }, []);

    useEffect(() => {
        const connect = () => {
            const url = buildWebSocketUrl();
            if (!url) {
                setStatus('idle');
                return;
            }

            try {
                setStatus('connecting');
                const socket = new WebSocket(url);
                socketRef.current = socket;

                socket.onopen = () => {
                    setStatus('connected');
                };

                socket.onmessage = async (event) => {
                    try {
                        // 处理不同数据类型
                        let data: string | null = null;
                        if (typeof event.data === 'string') {
                            data = event.data;
                        } else if (event.data instanceof Blob) {
                            data = await event.data.text();
                        } else if (event.data instanceof ArrayBuffer) {
                            data = new TextDecoder().decode(event.data);
                        } else if (ArrayBuffer.isView(event.data)) {
                            data = new TextDecoder().decode(event.data.buffer);
                        } else {
                            data = String(event.data ?? '');
                        }

                        if (!data) {
                            return;
                        }

                        const trimmed = data.trim();
                        if (!trimmed) {
                            return;
                        }

                        // 某些后端心跳或非 JSON 消息，例如 "pong"
                        if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
                            if (trimmed.toLowerCase() !== 'pong') {
                                console.debug('Notification WS non-JSON message:', trimmed);
                            }
                            return;
                        }

                        const payload = JSON.parse(trimmed);
                        if (payload?.type === 'notification') {
                            onNotification?.(payload.data as NotificationItem);
                        } else if (payload?.type === 'notification_ack') {
                            console.log('Notification WebSocket connected:', payload.message);
                        }
                    } catch (err) {
                        console.error('Failed to parse notification payload:', err, 'Data:', event.data);
                    }
                };

                socket.onerror = (event) => {
                    setStatus('disconnected');
                    onError?.(event);
                };

                socket.onclose = () => {
                    setStatus('disconnected');
                    if (reconnectTimer.current) {
                        window.clearTimeout(reconnectTimer.current);
                    }
                    reconnectTimer.current = window.setTimeout(() => {
                        connect();
                    }, 4000);
                };
            } catch (err) {
                console.error('Failed to connect notification WebSocket:', err);
                setStatus('disconnected');
            }
        };

        connect();

        return () => {
            if (reconnectTimer.current) {
                window.clearTimeout(reconnectTimer.current);
            }
            socketRef.current?.close();
        };
    }, [buildWebSocketUrl, onNotification, onError]);

    return { status, isConnected: status === 'connected' };
}


