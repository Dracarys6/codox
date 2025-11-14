import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { apiClient } from '../api/client';
import { calculateSHA256, uploadSnapshot } from '../utils/snapshot';

interface DocumentEditorProps {
    docId: number;
    onSave?: () => void;
}

export function DocumentEditor({ docId, onSave }: DocumentEditorProps) {
    const ydocRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const saveIntervalRef = useRef<number | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // 获取 WebSocket URL（从环境变量或使用默认值）
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: '开始输入文档内容...',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'focus:outline-none prose prose-lg max-w-none',
            },
        },
        editable: true,
    });

    useEffect(() => {
        if (!editor) return;

        let isMounted = true;
        let type: Y.XmlFragment | null = null;

        // 初始化协作连接
        const connectCollaboration = async () => {
            try {
                // 1. 创建 Yjs 文档
                const ydoc = new Y.Doc();
                ydocRef.current = ydoc;

                // 2. 获取协作令牌
                const tokenResponse = await apiClient.getCollaborationToken(docId);
                const { token } = tokenResponse;

                // 3. 获取引导快照（如果有）
                try {
                    const bootstrapResponse = await apiClient.getBootstrap(docId);
                    const { snapshot_url } = bootstrapResponse;

                    // 如果有快照，加载它
                    if (snapshot_url && snapshot_url !== 'null') {
                        try {
                            let snapshotBytes: Uint8Array;

                            // 处理不同的快照格式
                            if (snapshot_url.startsWith('data:')) {
                                // Base64 编码的数据 URL
                                const base64Data = snapshot_url.split(',')[1];
                                const jsonData = atob(base64Data);
                                const snapshotData = JSON.parse(jsonData);
                                snapshotBytes = new Uint8Array(snapshotData);
                            } else {
                                // 普通的 URL，尝试获取二进制数据
                                const snapshotResponse = await fetch(snapshot_url);
                                const arrayBuffer = await snapshotResponse.arrayBuffer();
                                snapshotBytes = new Uint8Array(arrayBuffer);
                            }

                            if (snapshotBytes.length > 0) {
                                Y.applyUpdate(ydoc, snapshotBytes);
                            }
                        } catch (error) {
                            console.warn('Failed to load snapshot, starting with empty document:', error);
                        }
                    }
                } catch (error) {
                    console.warn('Failed to get bootstrap snapshot, starting with empty document:', error);
                }

                // 4. 创建 Yjs 类型
                type = ydoc.getXmlFragment('prosemirror');

                // 5. 连接 WebSocket
                const provider = new WebsocketProvider(
                    wsUrl,
                    `doc-${docId}`,
                    ydoc,
                    {
                        params: { token },
                    }
                );
                providerRef.current = provider;

                // 监听连接状态
                provider.on('status', (event: { status: string }) => {
                    if (isMounted) {
                        console.log('WebSocket status:', event.status);
                        if (event.status === 'connected') {
                            setIsConnected(true);
                        } else {
                            setIsConnected(false);
                        }
                    }
                });

                // 监听同步状态（当 Yjs 文档同步完成时）
                provider.on('sync', (isSynced: boolean) => {
                    if (isMounted && isSynced) {
                        setIsConnected(true);
                    }
                });

                // 6. 同步编辑器内容到 Yjs
                // 注意：这是一个简化的实现，完整的协作功能需要使用 @tiptap/extension-collaboration
                // 这里我们主要依赖 WebsocketProvider 进行基本的文档同步
                if (isMounted && editor && type && ydoc) {
                    // 监听Yjs文档变化并更新编辑器
                    const currentType = type; // 创建局部变量避免null检查问题
                    const updateHandler = () => {
                        if (!isMounted || !currentType) return;
                        const xmlContent = currentType.toString();
                        if (xmlContent && editor.getHTML() !== xmlContent) {
                            // 暂时不自动同步，避免冲突
                            // 在实际应用中应该使用 @tiptap/extension-collaboration
                        }
                    };

                    currentType.observeDeep(updateHandler);
                }

                // 7. 定期保存快照（每 30 秒）
                saveIntervalRef.current = window.setInterval(async () => {
                    if (!isMounted) return;

                    try {
                        const state = Y.encodeStateAsUpdate(ydoc);
                        const snapshot = Array.from(state);

                        if (snapshot.length === 0) return; // 空文档不保存

                        const snapshotJson = JSON.stringify(snapshot);
                        const sha256 = await calculateSHA256(snapshotJson);

                        // 上传到 MinIO（这里需要实现上传逻辑）
                        const snapshotUrl = await uploadSnapshot(docId, snapshot, sha256);

                        // 回调到后端
                        try {
                            await apiClient.saveSnapshot(docId, {
                                snapshot_url: snapshotUrl,
                                sha256,
                                size_bytes: snapshot.length,
                            });

                            if (onSave && isMounted) {
                                onSave();
                            }
                        } catch (error) {
                            console.error('Failed to save snapshot:', error);
                        }
                    } catch (error) {
                        console.error('Failed to create snapshot:', error);
                    }
                }, 30000);

            } catch (error) {
                console.error('Failed to connect collaboration:', error);
                // 即使协作连接失败，也允许本地编辑
            }
        };

        connectCollaboration();

        // 清理函数
        return () => {
            isMounted = false;

            if (saveIntervalRef.current !== null) {
                window.clearInterval(saveIntervalRef.current);
                saveIntervalRef.current = null;
            }
            if (providerRef.current) {
                providerRef.current.destroy();
                providerRef.current = null;
            }
            if (ydocRef.current) {
                ydocRef.current.destroy();
                ydocRef.current = null;
            }
        };
    }, [editor, docId, wsUrl, onSave]);

    return (
        <div className="border-2 border-blue-300/60 rounded-2xl bg-white shadow-xl overflow-hidden">
            {/* 连接状态提示 */}
            <div className="px-6 py-4 border-b-2 border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-blue-50/30">
                {!isConnected ? (
                    <div className="flex items-center justify-center gap-3 text-sm font-medium text-yellow-700 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl px-5 py-3 border border-yellow-200/50">
                        <svg className="animate-spin h-5 w-5 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>正在连接协作服务器...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-3 text-sm font-semibold text-green-700 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl px-5 py-3 border border-green-200/50">
                        <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>已成功连接协作服务器，可以开始编辑</span>
                    </div>
                )}
            </div>
            {/* 编辑器内容区域 */}
            <div className="bg-white border-t-2 border-gray-200/60 focus-within:ring-4 focus-within:ring-blue-200/50 focus-within:border-blue-400 transition-all duration-300">
                <div className="min-h-[500px] p-8">
                    <style>{`
                        .ProseMirror {
                            outline: none;
                            min-height: 500px;
                            font-size: 16px;
                            line-height: 1.8;
                            color: #1f2937;
                        }
                        .ProseMirror p {
                            margin: 1em 0;
                        }
                        .ProseMirror p.is-editor-empty:first-child::before {
                            content: attr(data-placeholder);
                            float: left;
                            color: #9ca3af;
                            pointer-events: none;
                            height: 0;
                        }
                        .ProseMirror:focus {
                            outline: none;
                        }
                        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
                            font-weight: bold;
                            margin-top: 1.5em;
                            margin-bottom: 0.5em;
                        }
                        .ProseMirror h1 {
                            font-size: 2em;
                        }
                        .ProseMirror h2 {
                            font-size: 1.5em;
                        }
                        .ProseMirror h3 {
                            font-size: 1.25em;
                        }
                    `}</style>
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    );
}

