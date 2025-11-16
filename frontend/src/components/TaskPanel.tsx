import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';

interface Task {
    id: number;
    doc_id: number;
    title: string;
    status: 'todo' | 'doing' | 'done';
    assignee_id?: number;
    assignee?: {
        id: number;
        email: string;
        nickname?: string;
        avatar_url?: string;
    };
    due_at?: string;
    created_by: number;
    created_at: string;
    updated_at: string;
}

interface TaskPanelProps {
    docId: number;
}

export function TaskPanel({ docId }: TaskPanelProps) {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTasks();
    }, [docId]);

    const loadTasks = async () => {
        try {
            setIsLoading(true);
            const response = await apiClient.getTasks(docId);
            setTasks(response.tasks || []);
        } catch (err: any) {
            console.error('Failed to load tasks:', err);
            alert(err.response?.data?.error || '加载任务失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            setLoading(true);
            await apiClient.createTask(docId, {
                title: newTaskTitle.trim(),
            });
            setNewTaskTitle('');
            loadTasks();
        } catch (err: any) {
            console.error('Failed to create task:', err);
            alert(err.response?.data?.error || '创建任务失败');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (taskId: number, newStatus: 'todo' | 'doing' | 'done') => {
        try {
            await apiClient.updateTask(taskId, {
                status: newStatus,
            });
            loadTasks();
        } catch (err: any) {
            console.error('Failed to update task:', err);
            alert(err.response?.data?.error || '更新任务失败');
        }
    };

    const handleDelete = async (taskId: number) => {
        if (!confirm('确定要删除这个任务吗？')) return;

        try {
            await apiClient.deleteTask(taskId);
            loadTasks();
        } catch (err: any) {
            console.error('Failed to delete task:', err);
            alert(err.response?.data?.error || '删除任务失败');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'todo':
                return 'bg-gray-100 text-gray-800 border-gray-300';
            case 'doing':
                return 'bg-warning/20 text-warning border-warning/50';
            case 'done':
                return 'bg-secondary/20 text-secondary border-secondary/50';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'todo':
                return '待办';
            case 'doing':
                return '进行中';
            case 'done':
                return '已完成';
            default:
                return status;
        }
    };

    const todoTasks = tasks.filter((t) => t.status === 'todo');
    const doingTasks = tasks.filter((t) => t.status === 'doing');
    const doneTasks = tasks.filter((t) => t.status === 'done');

    return (
        <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fa fa-tasks mr-2 text-primary"></i>
                任务 ({tasks.length})
            </h3>

            {isLoading ? (
                <div className="text-center py-8">
                    <i className="fa fa-spinner fa-spin text-2xl text-gray-400"></i>
                </div>
            ) : (
                <>
                    {/* 任务列表 */}
                    <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                        {tasks.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <i className="fa fa-check-square-o text-4xl mb-2"></i>
                                <p>暂无任务</p>
                            </div>
                        ) : (
                            <>
                                {/* 待办任务 */}
                                {todoTasks.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">待办</h4>
                                        <div className="space-y-2">
                                            {todoTasks.map((task) => (
                                                <TaskItem
                                                    key={task.id}
                                                    task={task}
                                                    getStatusColor={getStatusColor}
                                                    getStatusText={getStatusText}
                                                    onUpdateStatus={handleUpdateStatus}
                                                    onDelete={handleDelete}
                                                    user={user}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 进行中任务 */}
                                {doingTasks.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">进行中</h4>
                                        <div className="space-y-2">
                                            {doingTasks.map((task) => (
                                                <TaskItem
                                                    key={task.id}
                                                    task={task}
                                                    getStatusColor={getStatusColor}
                                                    getStatusText={getStatusText}
                                                    onUpdateStatus={handleUpdateStatus}
                                                    onDelete={handleDelete}
                                                    user={user}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 已完成任务 */}
                                {doneTasks.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">已完成</h4>
                                        <div className="space-y-2">
                                            {doneTasks.map((task) => (
                                                <TaskItem
                                                    key={task.id}
                                                    task={task}
                                                    getStatusColor={getStatusColor}
                                                    getStatusText={getStatusText}
                                                    onUpdateStatus={handleUpdateStatus}
                                                    onDelete={handleDelete}
                                                    user={user}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* 创建任务 */}
                    <form onSubmit={handleCreate} className="space-y-2">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="新任务标题..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-custom"
                        />
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || !newTaskTitle.trim()}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-custom shadow-lg shadow-primary/20"
                            >
                                {loading ? (
                                    <>
                                        <i className="fa fa-spinner fa-spin mr-2"></i>创建中...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-plus mr-2"></i>创建任务
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

interface TaskItemProps {
    task: Task;
    getStatusColor: (status: string) => string;
    getStatusText: (status: string) => string;
    onUpdateStatus: (taskId: number, status: 'todo' | 'doing' | 'done') => void;
    onDelete: (taskId: number) => void;
    user: any;
}

function TaskItem({ task, getStatusColor, getStatusText, onUpdateStatus, onDelete, user }: TaskItemProps) {
    return (
        <div className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-custom bg-white">
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(task.status)}`}>
                            {getStatusText(task.status)}
                        </span>
                        {task.assignee && (
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                                <i className="fa fa-user"></i>
                                {task.assignee.nickname || task.assignee.email}
                            </span>
                        )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    {task.due_at && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <i className="fa fa-clock-o"></i>
                            截止: {new Date(task.due_at).toLocaleString('zh-CN')}
                        </p>
                    )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    {task.status !== 'done' && (
                        <button
                            onClick={() => onUpdateStatus(task.id, task.status === 'todo' ? 'doing' : 'done')}
                            className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-custom"
                            title={task.status === 'todo' ? '开始任务' : '完成任务'}
                        >
                            <i className={`fa ${task.status === 'todo' ? 'fa-play' : 'fa-check'} mr-1`}></i>
                            {task.status === 'todo' ? '开始' : '完成'}
                        </button>
                    )}
                    {(user && (user.id === task.created_by || user.role === 'admin')) && (
                        <button
                            onClick={() => onDelete(task.id)}
                            className="text-xs px-3 py-1 bg-danger text-white rounded hover:bg-danger/90 transition-custom"
                            title="删除任务"
                        >
                            <i className="fa fa-trash-o"></i>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

