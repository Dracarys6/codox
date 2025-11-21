import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'disabled';

interface UseChatWebSocketOptions {
    roomId?: number | null;
    onMessage?: (message: ChatMessage) => void;
    onJoin?: (payload: any) => void;
    onClose?: () => void;
}

const CHAT_WS_BASE = (import.meta.env.VITE_CHAT_WS_URL as string | undefined)?.trim();

export function useChatWebSocket({ roomId, onMessage, onJoin, onClose }: UseChatWebSocketOptions) {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!roomId) {
            setStatus('idle');
            return;
        }

        if (!CHAT_WS_BASE) {
            setStatus('disabled');
            return;
        }

        let url: URL;
        try {
            url = new URL(CHAT_WS_BASE);
        } catch (err) {
            console.error('Invalid VITE_CHAT_WS_URL:', CHAT_WS_BASE, err);
            setStatus('disabled');
            return;
        }

        const token = localStorage.getItem('access_token');
        console.log('前端传递的 Chat Token:', token); // 关键：打印实际传递的 Token
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
                let data: string;
                if (event.data instanceof Blob) {
                    data = await event.data.text();
                } else if (typeof event.data === 'string') {
                    data = event.data;
                } else {
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


