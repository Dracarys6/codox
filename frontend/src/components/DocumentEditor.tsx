import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { apiClient } from '../api/client';
import { calculateSHA256, uploadSnapshot } from '../utils/snapshot';

interface DocumentEditorProps {
    docId: number;
    onSave?: () => void;
    onSaveReady?: (saveFn: () => Promise<void>) => void; // 保存函数准备好时的回调
}

export function DocumentEditor({ docId, onSave, onSaveReady }: DocumentEditorProps) {
    const providerRef = useRef<WebsocketProvider | null>(null);
    const saveIntervalRef = useRef<number | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const saveSnapshotRef = useRef<(() => Promise<void>) | null>(null);
    const [collabResources, setCollabResources] = useState<{
        ydoc: Y.Doc;
        provider: WebsocketProvider;
        docName: string;
    } | null>(null);

    const userColor = useMemo(() => {
        const colors = [
            '#f87171',
            '#fb923c',
            '#facc15',
            '#34d399',
            '#60a5fa',
            '#a78bfa',
            '#f472b6',
        ];
        return colors[docId % colors.length];
    }, [docId]);

    // 获取 WebSocket URL（从环境变量或使用默认值）
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';

    const editor = useEditor(
        {
            extensions: [
                StarterKit,
                Placeholder.configure({
                    placeholder: '开始输入文档内容...',
                }),
                ...(collabResources
                    ? [
                        Collaboration.configure({
                            document: collabResources.ydoc,
                            field: 'prosemirror',
                        }),
                    ]
                    : []),
            ],
            content: '',
            editorProps: {
                attributes: {
                    class: 'focus:outline-none prose prose-lg max-w-none min-h-[70vh] pb-16',
                },
            },
            editable: true,
        },
        [collabResources?.ydoc, docId]
    );

    useEffect(() => {
        let isMounted = true;
        const ydoc = new Y.Doc();
        let provider: WebsocketProvider | null = null;

        const setupCollaboration = async () => {
            try {
                const tokenResponse = await apiClient.getCollaborationToken(docId);
                const { token } = tokenResponse;

                try {
                    const bootstrapResponse = await apiClient.getBootstrap(docId);
                    const { snapshot_url, content_html, content_text } = bootstrapResponse;

                    // 优化：如果有 HTML 内容，优先使用 HTML 内容初始化（更可靠）
                    // 这样可以避免快照文件可能指向旧内容的问题（特别是恢复的版本）
                    const hasHtmlContent = content_html && content_html.trim().length > 0;
                    const hasTextContent = content_text && content_text.trim().length > 0;

                    // 如果有 HTML 内容，强制使用 HTML 内容初始化（优先于快照）
                    // 这确保恢复的版本显示正确的内容
                    if (hasHtmlContent || hasTextContent) {
                        console.log('HTML content available, will initialize from HTML (preferred for restored versions)...');

                        // 将 HTML 内容存储到 Yjs 的临时字段中，等待编辑器准备好后初始化
                        ydoc.getMap('temp').set('html_content', content_html || '');
                        ydoc.getMap('temp').set('text_content', content_text || '');
                        ydoc.getMap('temp').set('needs_html_init', true);

                        console.log('Stored HTML content for later initialization, length:', (content_html || '').length);
                    } else if (snapshot_url && snapshot_url !== 'null') {
                        // 只有在没有 HTML 内容时才尝试加载快照
                        try {
                            let snapshotBytes: Uint8Array;
                            if (snapshot_url.startsWith('data:')) {
                                const base64Data = snapshot_url.split(',')[1];
                                const jsonData = atob(base64Data);
                                const snapshotData = JSON.parse(jsonData);
                                snapshotBytes = new Uint8Array(snapshotData);
                            } else if (snapshot_url.startsWith('/api/collab/snapshot/')) {
                                const arrayBuffer = await apiClient.downloadSnapshot(docId);
                                snapshotBytes = new Uint8Array(arrayBuffer);
                            } else {
                                const snapshotResponse = await fetch(snapshot_url);
                                if (!snapshotResponse.ok) {
                                    throw new Error(`Failed to fetch snapshot: ${snapshotResponse.status}`);
                                }
                                const arrayBuffer = await snapshotResponse.arrayBuffer();
                                snapshotBytes = new Uint8Array(arrayBuffer);
                            }

                            if (snapshotBytes.length > 0) {
                                Y.applyUpdate(ydoc, snapshotBytes);
                                console.log('Snapshot loaded successfully, size:', snapshotBytes.length);
                            }
                        } catch (error) {
                            console.warn('Failed to load snapshot:', error);
                        }
                    }
                } catch (error) {
                    console.warn('Failed to get bootstrap snapshot, starting with empty document:', error);
                }

                const docName = `doc-${docId}`;
                const baseWsUrl = wsUrl || 'ws://localhost:1234';
                provider = new WebsocketProvider(baseWsUrl, docName, ydoc, {
                    params: {
                        docId: String(docId),
                        token,
                        docName,
                    },
                });
                providerRef.current = provider;

                provider.awareness.setLocalStateField('user', {
                    name: `User-${docId}`,
                    color: userColor,
                });

                if (isMounted) {
                    setCollabResources({ ydoc, provider, docName });
                }
            } catch (error) {
                console.error('Failed to initialize collaboration:', error);
                provider?.destroy();
                ydoc.destroy();
            }
        };

        setupCollaboration();

        return () => {
            isMounted = false;
            setCollabResources(null);
            if (provider) {
                provider.destroy();
            }
            ydoc.destroy();
            providerRef.current = null;
        };
    }, [docId, wsUrl, userColor]);

    useEffect(() => {
        if (!editor || !collabResources) return;

        let isMounted = true;
        let initTimeout: number | null = null;
        const { ydoc, provider } = collabResources;

        const handleStatus = (event: { status: string }) => {
            if (isMounted) {
                console.log('WebSocket status:', event.status);
                setIsConnected(event.status === 'connected');
            }
        };

        // 检查是否需要从 HTML 初始化内容（导入的文档或恢复的版本）
        const checkAndInitFromHtml = () => {
            if (!editor || !isMounted) return;

            try {
                const tempMap = ydoc.getMap('temp');
                const needsInit = tempMap.get('needs_html_init');
                const htmlContent = tempMap.get('html_content') as string | undefined;

                if (needsInit && htmlContent) {
                    // 优化：对于恢复的版本，应该强制设置内容，而不是检查是否为空
                    // 因为编辑器可能还保留着之前的内容（通过 WebSocket 同步）
                    console.log('Initializing editor from HTML content (force mode for restored versions)...');
                    console.log('HTML content length:', htmlContent.length);

                    // 先清除 Yjs 文档中的 prosemirror 内容，确保从干净状态开始
                    try {
                        const prosemirrorType = ydoc.get('prosemirror', Y.XmlFragment);
                        if (prosemirrorType && prosemirrorType.length > 0) {
                            console.log('Clearing existing Yjs content before initializing from HTML...');
                            // 删除所有子节点
                            while (prosemirrorType.length > 0) {
                                prosemirrorType.delete(0);
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to clear Yjs content:', e);
                    }

                    // 使用 TipTap 的 setContent 方法从 HTML 初始化
                    // 这会替换当前内容，确保显示恢复的版本内容
                    // 使用 setTimeout 确保在下一个事件循环中执行，避免与 Yjs 同步冲突
                    setTimeout(() => {
                        if (editor && isMounted) {
                            editor.commands.setContent(htmlContent);
                            console.log('Editor initialized from HTML successfully');
                        }
                    }, 100);

                    // 清除标记，避免重复初始化
                    tempMap.delete('needs_html_init');
                    tempMap.delete('html_content');
                    tempMap.delete('text_content');
                }
            } catch (error) {
                console.error('Failed to initialize from HTML:', error);
            }
        };

        const handleSync = (isSynced: boolean) => {
            if (isMounted && isSynced) {
                setIsConnected(true);
                // 当 Yjs 同步完成时检查是否需要从 HTML 初始化
                setTimeout(() => {
                    checkAndInitFromHtml();
                }, 200);
            }
        };

        provider.on('status', handleStatus);
        provider.on('sync', handleSync);

        // 延迟检查，确保编辑器完全初始化
        initTimeout = window.setTimeout(() => {
            checkAndInitFromHtml();
        }, 500);

        const saveSnapshot = async (): Promise<void> => {
            if (!isMounted) return;
            if (!docId || isNaN(docId) || docId <= 0) {
                console.error('Invalid docId, skipping snapshot save:', docId);
                return;
            }

            try {
                const state = Y.encodeStateAsUpdate(ydoc);
                const snapshot = Array.from(state);

                if (snapshot.length === 0) {
                    console.log('Empty document, skipping save');
                    return;
                }

                const snapshotJson = JSON.stringify(snapshot);
                const sha256 = await calculateSHA256(snapshotJson);
                const snapshotUrl = await uploadSnapshot(docId, snapshot, sha256);

                await apiClient.saveSnapshot(docId, {
                    snapshot_url: snapshotUrl,
                    sha256,
                    size_bytes: snapshot.length,
                });

                if (onSave && isMounted) {
                    onSave();
                }
                console.log('Snapshot saved successfully');
            } catch (error) {
                console.error('Failed to save snapshot:', error);
                throw error;
            }
        };

        saveSnapshotRef.current = saveSnapshot;

        if (onSaveReady) {
            onSaveReady(saveSnapshot);
        }

        saveIntervalRef.current = window.setInterval(async () => {
            try {
                await saveSnapshot();
            } catch (error) {
                console.error('Periodic save failed:', error);
            }
        }, 30000);

        return () => {
            isMounted = false;
            if (initTimeout !== null) {
                window.clearTimeout(initTimeout);
            }
            if (saveIntervalRef.current !== null) {
                window.clearInterval(saveIntervalRef.current);
                saveIntervalRef.current = null;
            }
            if (provider?.off) {
                provider.off('status', handleStatus as any);
                provider.off('sync', handleSync as any);
            }
            if (saveSnapshotRef.current === saveSnapshot) {
                saveSnapshotRef.current = null;
            }
        };
    }, [editor, collabResources, docId, onSave, onSaveReady]);

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

