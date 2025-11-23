import { useState, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import apiClient from '../api/client';
import { toast } from './ui/Toast';
import { Document } from '../types';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess?: (document: Document) => void;
}

export function ImportModal({ isOpen, onClose, onImportSuccess }: ImportModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [markdownContent, setMarkdownContent] = useState('');
    const [markdownTitle, setMarkdownTitle] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 处理文件选择
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 验证文件类型
        if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
            toast.error('请选择 .md 或 .markdown 格式的 Markdown 文档');
            return;
        }

        // 验证文件大小（50MB限制）
        if (file.size > 50 * 1024 * 1024) {
            toast.error('文件大小不能超过 50MB');
            return;
        }

        await handleImport(file);
    };

    // 执行导入
    const handleImport = async (file?: File) => {
        setIsLoading(true);
        try {
            let document: Document;

            if (file) {
                // 文件上传方式
                document = await apiClient.importMarkdown(file);
            } else {
                // 文本输入方式
                if (!markdownContent.trim()) {
                    toast.error('请选择文件或输入 Markdown 内容');
                    return;
                }
                document = await apiClient.importMarkdown({
                    markdown: markdownContent,
                    title: markdownTitle || '导入的 Markdown 文档',
                });
            }

            toast.success('文档导入成功！');
            onImportSuccess?.(document);
            handleClose();
        } catch (error: any) {
            console.error('导入失败:', error);
            toast.error(error?.response?.data?.error || error?.message || '导入失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    // 关闭弹窗并重置状态
    const handleClose = () => {
        setMarkdownContent('');
        setMarkdownTitle('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    // 触发文件选择
    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="导入 Markdown 文档"
            description="支持上传 Markdown 文件或直接粘贴 Markdown 内容"
            size="lg"
        >
            <div className="space-y-6">
                {/* 文件上传区域 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择 Markdown 文档 (.md)
                    </label>
                    <div
                        onClick={triggerFileSelect}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".md,.markdown"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="space-y-2">
                            <div className="text-4xl">📝</div>
                            <p className="text-gray-600">
                                点击选择文件或拖拽文件到此处
                            </p>
                            <p className="text-sm text-gray-500">
                                支持 .md, .markdown 格式，最大 50MB
                            </p>
                        </div>
                    </div>
                </div>

                {/* Markdown 文本输入区域（可选，如果未选择文件） */}
                {!fileInputRef.current?.files?.[0] && (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-600 mb-2">
                            或者直接粘贴 Markdown 内容：
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                文档标题（可选）
                            </label>
                            <Input
                                type="text"
                                placeholder="输入文档标题..."
                                value={markdownTitle}
                                onChange={(e) => setMarkdownTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Markdown 内容
                            </label>
                            <textarea
                                value={markdownContent}
                                onChange={(e) => setMarkdownContent(e.target.value)}
                                placeholder="# 标题&#10;&#10;这里是内容..."
                                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                            />
                            <p className="mt-2 text-sm text-gray-500">
                                支持标准 Markdown 语法
                            </p>
                        </div>
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                    <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                        取消
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => handleImport()}
                        isLoading={isLoading}
                        disabled={!fileInputRef.current?.files?.[0] && !markdownContent.trim()}
                    >
                        {isLoading ? '导入中...' : '导入文档'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
