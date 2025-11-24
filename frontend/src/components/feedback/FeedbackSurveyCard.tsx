import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../api/client';
import { toast } from '../ui/Toast';

const DIMENSION_OPTIONS = [
    { value: 'overall', label: '整体体验' },
    { value: 'collaboration', label: '协作效率' },
    { value: 'editor', label: '编辑体验' },
    { value: 'notification', label: '通知提醒' },
];

const SCORE_OPTIONS = [1, 2, 3, 4, 5];
const LOCAL_STORAGE_KEY = 'feedback:last_submitted_at';
const COOL_DOWN_HOURS = 12;

export function FeedbackSurveyCard() {
    const [score, setScore] = useState<number | null>(null);
    const [dimension, setDimension] = useState('overall');
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    useEffect(() => {
        const lastSubmittedAt = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!lastSubmittedAt) return;
        const diff = Date.now() - Number(lastSubmittedAt);
        if (diff < COOL_DOWN_HOURS * 60 * 60 * 1000) {
            setHasSubmitted(true);
        }
    }, []);

    const disabled = useMemo(() => hasSubmitted || isSubmitting, [hasSubmitted, isSubmitting]);

    const handleSubmit = async () => {
        if (score === null) {
            toast.warning('请选择评分');
            return;
        }
        setIsSubmitting(true);
        try {
            await apiClient.submitFeedback({
                dimension,
                score,
                comment: comment.trim() || undefined,
            });
            toast.success('感谢您的反馈！我们会持续改进。');
            localStorage.setItem(LOCAL_STORAGE_KEY, Date.now().toString());
            setHasSubmitted(true);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || '提交反馈失败，请稍后重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/70 shadow-sm overflow-hidden">
            <div className="px-6 py-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-inner">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121A3 3 0 1110 10.003m4.121 4.118L21 21" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">体验调研</p>
                        <h3 className="text-xl font-bold text-slate-900">告诉我们您的使用感受</h3>
                    </div>
                </div>

                {hasSubmitted ? (
                    <div className="rounded-xl bg-white/80 border border-blue-100 p-4 text-center">
                        <p className="text-sm text-slate-600">已收到您的反馈，感谢支持！</p>
                        <p className="text-xs text-slate-400 mt-2">12 小时后可再次提交</p>
                    </div>
                ) : (
                    <>
                        <label className="block text-sm font-medium text-slate-700 mb-1">关注方向</label>
                        <select
                            value={dimension}
                            onChange={(e) => setDimension(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 mb-4"
                            disabled={disabled}
                        >
                            {DIMENSION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <label className="block text-sm font-medium text-slate-700 mb-2">满意度评分</label>
                        <div className="flex gap-2 mb-4">
                            {SCORE_OPTIONS.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setScore(value)}
                                    disabled={disabled}
                                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                                        score === value
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-700 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                                    }`}
                                >
                                    {value} 分
                                </button>
                            ))}
                        </div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">更多建议（可选）</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            placeholder="欢迎留下您的想法或建议..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none mb-4"
                            disabled={disabled}
                        />

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={disabled}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/30 disabled:opacity-70"
                        >
                            {isSubmitting && <i className="fa fa-spinner fa-spin" />}
                            提交反馈
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}


