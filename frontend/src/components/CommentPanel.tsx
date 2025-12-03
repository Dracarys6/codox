import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';

interface Comment {
    id: number;
    doc_id: number;
    author_id: number;
    author: {
        id: number;
        email: string;
        nickname?: string;
        avatar_url?: string;
    };
    content: string;
    anchor?: any;
    parent_id?: number;
    created_at: string;
}

interface CommentNode extends Comment {
    children: CommentNode[];
}

interface CommentPanelProps {
    docId: number;
}

export function CommentPanel({ docId }: CommentPanelProps) {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [replyContent, setReplyContent] = useState<{ [key: number]: string }>({});
    const [loading, setLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadComments();
    }, [docId]);

    // 将扁平评论列表转换为树形结构
    const commentTree = useMemo(() => {
        const commentMap = new Map<number, CommentNode>();
        const rootComments: CommentNode[] = [];

        // 第一遍：创建所有节点
        comments.forEach((comment) => {
            commentMap.set(comment.id, { ...comment, children: [] });
        });

        // 第二遍：构建树形结构
        comments.forEach((comment) => {
            const node = commentMap.get(comment.id)!;
            if (comment.parent_id && commentMap.has(comment.parent_id)) {
                // 有父节点，添加到父节点的 children
                commentMap.get(comment.parent_id)!.children.push(node);
            } else {
                // 根节点
                rootComments.push(node);
            }
        });

        // 对每个节点的 children 按时间排序
        const sortChildren = (nodes: CommentNode[]) => {
            nodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            nodes.forEach((node) => {
                if (node.children.length > 0) {
                    sortChildren(node.children);
                }
            });
        };
        sortChildren(rootComments);

        return rootComments;
    }, [comments]);

    // 统计评论总数（包括回复）
    const totalCommentCount = useMemo(() => {
        const count = (nodes: CommentNode[]): number => {
            return nodes.reduce((sum, node) => sum + 1 + count(node.children), 0);
        };
        return count(commentTree);
    }, [commentTree]);

    const loadComments = async () => {
        try {
            setIsLoading(true);
            const response = await apiClient.getComments(docId);
            setComments(response.comments || []);
        } catch (err: any) {
            console.error('Failed to load comments:', err);
            alert(err.response?.data?.error || '加载评论失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            setLoading(true);
            await apiClient.createComment(docId, {
                content: newComment.trim(),
            });
            setNewComment('');
            loadComments();
        } catch (err: any) {
            console.error('Failed to create comment:', err);
            alert(err.response?.data?.error || '创建评论失败');
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async (parentId: number) => {
        const content = replyContent[parentId]?.trim();
        if (!content) return;

        try {
            setLoading(true);
            await apiClient.createComment(docId, {
                content,
                parent_id: parentId,
            });
            setReplyContent((prev) => {
                const newState = { ...prev };
                delete newState[parentId];
                return newState;
            });
            setReplyingTo(null);
            loadComments();
        } catch (err: any) {
            console.error('Failed to create reply:', err);
            alert(err.response?.data?.error || '回复失败');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!confirm('确定要删除这条评论吗？删除后所有回复也会被删除。')) return;

        try {
            await apiClient.deleteComment(commentId);
            loadComments();
        } catch (err: any) {
            console.error('Failed to delete comment:', err);
            alert(err.response?.data?.error || '删除评论失败');
        }
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

    // 递归渲染评论树
    const renderComment = (comment: CommentNode, depth: number = 0) => {
        const isReplying = replyingTo === comment.id;
        const hasChildren = comment.children.length > 0;

        return (
            <div key={comment.id} className={depth > 0 ? 'mt-3' : ''}>
                <div className={`flex gap-3 ${depth > 0 ? 'pl-4 border-l-2 border-gray-200' : ''}`}>
                    {/* 左侧连接线（仅在有子评论时显示） */}
                    {depth > 0 && (
                        <div className="flex-shrink-0 w-4 flex flex-col items-center">
                            <div className="w-0.5 h-4 bg-gray-300"></div>
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        {/* 评论内容 */}
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                            {comment.author.nickname?.[0] || comment.author.email[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium text-sm text-gray-900">
                                                {comment.author.nickname || comment.author.email}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-2">
                                                {formatTime(comment.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                        {comment.content}
                                    </p>
                                </div>
                                {user && (user.id === comment.author_id || user.role === 'admin') && (
                                    <button
                                        onClick={() => handleDelete(comment.id)}
                                        className="text-danger hover:text-danger/80 text-sm flex-shrink-0 px-2 py-1 rounded hover:bg-danger/10 transition-custom"
                                        title="删除评论"
                                    >
                                        <i className="fa fa-trash-o"></i>
                                    </button>
                                )}
                            </div>

                            {/* 回复按钮 */}
                            {user && (
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setReplyingTo(isReplying ? null : comment.id);
                                            if (!isReplying) {
                                                setReplyContent((prev) => ({ ...prev, [comment.id]: '' }));
                                            }
                                        }}
                                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition-custom"
                                    >
                                        <i className="fa fa-reply"></i>
                                        {isReplying ? '取消回复' : '回复'}
                                    </button>
                                    {hasChildren && (
                                        <span className="text-xs text-gray-500">
                                            {comment.children.length} 条回复
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* 回复输入框 */}
                            {isReplying && (
                                <div className="mt-3 space-y-2">
                                    <textarea
                                        value={replyContent[comment.id] || ''}
                                        onChange={(e) =>
                                            setReplyContent((prev) => ({ ...prev, [comment.id]: e.target.value }))
                                        }
                                        placeholder={`回复 ${comment.author.nickname || comment.author.email}...`}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom resize-none"
                                        rows={2}
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setReplyingTo(null);
                                                setReplyContent((prev) => {
                                                    const newState = { ...prev };
                                                    delete newState[comment.id];
                                                    return newState;
                                                });
                                            }}
                                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 rounded hover:bg-gray-100 transition-custom"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={() => handleReply(comment.id)}
                                            disabled={loading || !replyContent[comment.id]?.trim()}
                                            className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-custom"
                                        >
                                            {loading ? (
                                                <>
                                                    <i className="fa fa-spinner fa-spin mr-1"></i>提交中...
                                                </>
                                            ) : (
                                                '提交回复'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 递归渲染子评论 */}
                        {hasChildren && (
                            <div className="mt-3 space-y-3">
                                {comment.children.map((child) => renderComment(child, depth + 1))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fa fa-comments mr-2 text-primary"></i>
                评论 ({totalCommentCount})
            </h3>

            {isLoading ? (
                <div className="text-center py-8">
                    <i className="fa fa-spinner fa-spin text-2xl text-gray-400"></i>
                </div>
            ) : (
                <>
                    {/* 评论列表 */}
                    <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                        {commentTree.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <i className="fa fa-comment-o text-4xl mb-2"></i>
                                <p>暂无评论</p>
                            </div>
                        ) : (
                            commentTree.map((comment) => renderComment(comment))
                        )}
                    </div>

                    {/* 添加评论 */}
                    <form onSubmit={handleSubmit} className="space-y-2">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="添加评论..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || !newComment.trim()}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-custom shadow-lg shadow-primary/20"
                            >
                                {loading ? (
                                    <>
                                        <i className="fa fa-spinner fa-spin mr-2"></i>提交中...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-paper-plane mr-2"></i>提交评论
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}

