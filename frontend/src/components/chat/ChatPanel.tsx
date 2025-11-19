import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessage, ChatRoom } from '../../types';
import { useChatWebSocket } from '../../hooks/useChatWebSocket';

interface ChatPanelProps {
    docId: number;
}

const PAGE_SIZE = 30;

export function ChatPanel({ docId }: ChatPanelProps) {
    const { user } = useAuth();
    const [room, setRoom] = useState<ChatRoom | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [unreadBadge, setUnreadBadge] = useState(0);

    const scrollToBottom = (smooth = true) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
        }
    };

    const normalizeMessages = (incoming: ChatMessage[]) => {
        return [...incoming].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    };

    const loadMessages = async (roomId: number, options?: { beforeId?: number; append?: boolean }) => {
        try {
            setLoadingMessages(true);
            const response = await apiClient.getChatMessages(roomId, {
                page_size: PAGE_SIZE,
                before_id: options?.beforeId,
            });
            const normalized = normalizeMessages(response.messages);
            setMessages((prev) => {
                if (options?.append) {
                    const merged = [...normalized, ...prev];
                    const unique = new Map<number, ChatMessage>();
                    merged.forEach((msg) => {
                        unique.set(msg.id, msg);
                    });
                    return Array.from(unique.values()).sort(
                        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                }
                return normalized;
            });
            setHasMore(response.has_more);
        } catch (err: any) {
            console.error('Failed to load chat messages:', err);
            setError(err.response?.data?.error || '加载消息失败');
        } finally {
            setLoadingMessages(false);
        }
    };

    const ensureRoom = async () => {
        try {
            setLoadingRoom(true);
            setError(null);
            const existing = await apiClient.getChatRooms({ doc_id: docId, page: 1, page_size: 10 });
            let docRoom = existing.rooms.find((r) => r.doc_id === docId);
            if (!docRoom) {
                docRoom = await apiClient.createChatRoom({
                    type: 'document',
                    doc_id: docId,
                    name: `文档 ${docId} 讨论`,
                });
            }
            setRoom(docRoom);
            await loadMessages(docRoom.id);
            scrollToBottom(false);
        } catch (err: any) {
            console.error('Failed to initialize chat room:', err);
            setError(err.response?.data?.error || '初始化聊天失败，请稍后重试');
        } finally {
            setLoadingRoom(false);
        }
    };

    useEffect(() => {
        ensureRoom();
        return () => {
            setRoom(null);
            setMessages([]);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docId]);

    const handleIncomingMessage = useCallback(
        (message: ChatMessage) => {
            if (!room || message.room_id !== room.id) {
                return;
            }
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) {
                    return prev;
                }
                return [...prev, message];
            });
            if (message.sender_id !== user?.id) {
                setUnreadBadge((count) => count + 1);
            }
        },
        [room, user?.id]
    );

    const { status, isConnected } = useChatWebSocket({
        roomId: room?.id,
        onMessage: handleIncomingMessage,
        onClose: () => setUnreadBadge(0),
    });

    useEffect(() => {
        if (!loadingMessages) {
            scrollToBottom();
        }
    }, [messages, loadingMessages]);

    useEffect(() => {
        const latest = messages[messages.length - 1];
        if (!room || !latest) return;
        apiClient.markChatMessageRead(latest.id).catch(() => {
            /* ignore */
        });
        setUnreadBadge(0);
    }, [messages, room]);

    const handleSend = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!room || !inputValue.trim()) return;
        try {
            setSending(true);
            const newMessage = await apiClient.sendChatMessage(room.id, {
                content: inputValue.trim(),
                message_type: 'text',
            });
            setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) {
                    return prev;
                }
                return [...prev, newMessage];
            });
            setInputValue('');
            setError(null);
            scrollToBottom();
        } catch (err: any) {
            console.error('Failed to send chat message:', err);
            setError(err.response?.data?.error || '发送消息失败');
        } finally {
            setSending(false);
        }
    };

    const handleLoadMore = async () => {
        if (!room || loadingMessages || !hasMore || messages.length === 0) {
            return;
        }
        const firstMessage = messages[0];
        await loadMessages(room.id, { beforeId: firstMessage.id, append: true });
    };

    const statusText = useMemo(() => {
        switch (status) {
            case 'connected':
                return '已连接';
            case 'connecting':
                return '连接中...';
            case 'disconnected':
                return '已断开，稍后自动重连';
            default:
                return '等待连接';
        }
    }, [status]);

    if (loadingRoom) {
        return (
            <div className="text-center py-10">
                <i className="fa fa-spinner fa-spin text-2xl text-primary"></i>
                <p className="mt-3 text-sm text-gray-500">正在加载聊天...</p>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="text-center py-8 text-sm text-gray-500">
                无法加载聊天模块，请稍后重试。
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[520px]">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <i className="fa fa-comments text-primary"></i>
                        文档实时讨论
                        {unreadBadge > 0 && (
                            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger text-white text-xs px-1">
                                {unreadBadge}
                            </span>
                        )}
                    </p>
                    <p className={`text-xs ${isConnected ? 'text-green-600' : 'text-gray-500'}`}>{statusText}</p>
                </div>
                <button
                    onClick={() => loadMessages(room.id)}
                    className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                    刷新
                </button>
            </div>

            {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                </div>
            )}

            <div className="relative flex-1 rounded-2xl border border-gray-200 bg-white shadow-inner">
                <div className="absolute inset-0 flex flex-col">
                    <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                        <span>聊天室 ID: {room.id}</span>
                        {hasMore && (
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMessages}
                                className="text-primary hover:text-primary/80 disabled:opacity-50"
                            >
                                {loadingMessages ? '加载中...' : '查看更多'}
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {messages.length === 0 && !loadingMessages ? (
                            <div className="text-center text-gray-400 text-sm py-6">
                                暂无聊天内容，发送第一条消息吧～
                            </div>
                        ) : (
                            messages.map((message) => {
                                const isMine = message.sender_id === user?.id;
                                return (
                                    <div
                                        key={message.id}
                                        className={`flex flex-col ${isMine ? 'items-end text-right' : 'items-start text-left'}`}
                                    >
                                        <div className="text-xs text-gray-400 mb-1">
                                            {isMine
                                                ? user?.profile?.nickname || '我'
                                                : message.sender_nickname || `用户 ${message.sender_id}`}
                                        </div>
                                        <div
                                            className={`rounded-2xl px-3 py-2 text-sm shadow-sm max-w-[240px] ${
                                                isMine
                                                    ? 'bg-primary text-white rounded-tr-none'
                                                    : 'bg-gray-100 text-gray-900 rounded-tl-none'
                                            }`}
                                        >
                                            {message.content || <span className="italic text-gray-500">[无内容]</span>}
                                        </div>
                                        <div className="mt-1 text-[10px] text-gray-400">
                                            {new Date(message.created_at).toLocaleString('zh-CN')}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            <form onSubmit={handleSend} className="mt-3 flex flex-col gap-2">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={isConnected ? '输入消息内容...' : '等待连接中...'}
                        disabled={!isConnected || sending}
                        className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <button
                        type="submit"
                        disabled={!isConnected || sending || !inputValue.trim()}
                        className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {sending ? '发送中...' : '发送'}
                    </button>
                </div>
            </form>
        </div>
    );
}


