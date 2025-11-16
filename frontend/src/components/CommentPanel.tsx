import { useState, useEffect } from 'react';
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

interface CommentPanelProps {
    docId: number;
}

export function CommentPanel({ docId }: CommentPanelProps) {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadComments();
    }, [docId]);

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

    const handleDelete = async (commentId: number) => {
        if (!confirm('确定要删除这条评论吗？')) return;

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

    return (
        <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fa fa-comments mr-2 text-primary"></i>
                评论 ({comments.length})
            </h3>

            {isLoading ? (
                <div className="text-center py-8">
                    <i className="fa fa-spinner fa-spin text-2xl text-gray-400"></i>
                </div>
            ) : (
                <>
                    {/* 评论列表 */}
                    <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                        {comments.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <i className="fa fa-comment-o text-4xl mb-2"></i>
                                <p>暂无评论</p>
                            </div>
                        ) : (
                            comments.map((comment) => (
                                <div key={comment.id} className="border-b border-gray-100 pb-3 last:border-b-0">
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
                                </div>
                            ))
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

