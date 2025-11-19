import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface UseChatWebSocketOptions {
    roomId?: number | null;
    onMessage?: (message: ChatMessage) => void;
    onJoin?: (payload: any) => void;
    onClose?: () => void;
}

export function useChatWebSocket({ roomId, onMessage, onJoin, onClose }: UseChatWebSocketOptions) {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!roomId) {
            return;
        }

        const token = localStorage.getItem('access_token');
        const chatBase =
            import.meta.env.VITE_CHAT_WS_URL ||
            `${(import.meta.env.VITE_WS_URL || 'ws://localhost:1234').replace(/\/$/, '')}/chat`;

        const url = new URL(chatBase);
        url.searchParams.set('room_id', String(roomId));
        if (token) {
            url.searchParams.set('token', token);
        }

        const socket = new WebSocket(url.toString());
        socketRef.current = socket;
        setStatus('connecting');

        socket.onopen = () => {
            setStatus('connected');
            socket.send(
                JSON.stringify({
                    type: 'join',
                    room_id: roomId,
                })
            );
        };

        socket.onmessage = async (event) => {
            try {
                // 处理 Blob 或字符串数据
                let data: string;
                if (event.data instanceof Blob) {
                    data = await event.data.text();
                } else if (typeof event.data === 'string') {
                    data = event.data;
                } else {
                    // 尝试转换为字符串
                    data = String(event.data);
                }

                const payload = JSON.parse(data);
                switch (payload.type) {
                    case 'message':
                        onMessage?.(payload as ChatMessage);
                        break;
                    case 'join':
                        onJoin?.(payload);
                        break;
                    default:
                        break;
                }
            } catch (err) {
                console.error('Failed to parse chat message:', err, 'Data:', event.data);
            }
        };

        socket.onerror = (error) => {
            console.error('Chat WebSocket error:', error);
            setStatus('disconnected');
        };

        socket.onclose = () => {
            setStatus('disconnected');
            onClose?.();
        };

        return () => {
            socket.close();
        };
    }, [roomId, onMessage, onJoin, onClose]);

    const sendRaw = (payload: Record<string, unknown>) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return;
        }
        socketRef.current.send(JSON.stringify(payload));
    };

    return {
        status,
        isConnected: status === 'connected',
        sendRaw,
    };
}


