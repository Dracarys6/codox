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

type ImportType = 'word' | 'pdf' | 'markdown';

export function ImportModal({ isOpen, onClose, onImportSuccess }: ImportModalProps) {
    const [importType, setImportType] = useState<ImportType>('word');
    const [isLoading, setIsLoading] = useState(false);
    const [markdownContent, setMarkdownContent] = useState('');
    const [markdownTitle, setMarkdownTitle] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 处理文件选择
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 验证文件类型
        if (importType === 'word' && !file.name.endsWith('.docx')) {
            toast.error('请选择 .docx 格式的 Word 文档');
            return;
        }
        if (importType === 'pdf' && !file.name.endsWith('.pdf')) {
            toast.error('请选择 .pdf 格式的 PDF 文档');
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

            if (importType === 'word') {
                if (!file) {
                    toast.error('请选择文件');
                    return;
                }
                document = await apiClient.importWord(file);
            } else if (importType === 'pdf') {
                if (!file) {
                    toast.error('请选择文件');
                    return;
                }
                document = await apiClient.importPdf(file);
            } else {
                // Markdown
                if (!markdownContent.trim()) {
                    toast.error('请输入 Markdown 内容');
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
        setImportType('word');
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
            title="导入文档"
            description="支持导入 Word、PDF 或 Markdown 格式的文档"
            size="lg"
        >
            <div className="space-y-6">
                {/* 导入类型选择 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择导入类型
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {(['word', 'pdf', 'markdown'] as ImportType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => {
                                    setImportType(type);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                                className={`
                                    px-4 py-3 rounded-lg border-2 transition-all
                                    ${
                                        importType === type
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                    }
                                `}
                            >
                                {type === 'word' && '📄 Word'}
                                {type === 'pdf' && '📕 PDF'}
                                {type === 'markdown' && '📝 Markdown'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 文件上传区域（Word 和 PDF） */}
                {(importType === 'word' || importType === 'pdf') && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {importType === 'word' ? '选择 Word 文档 (.docx)' : '选择 PDF 文档 (.pdf)'}
                        </label>
                        <div
                            onClick={triggerFileSelect}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={importType === 'word' ? '.docx' : '.pdf'}
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div className="space-y-2">
                                <div className="text-4xl">
                                    {importType === 'word' ? '📄' : '📕'}
                                </div>
                                <p className="text-gray-600">
                                    点击选择文件或拖拽文件到此处
                                </p>
                                <p className="text-sm text-gray-500">
                                    支持 {importType === 'word' ? '.docx' : '.pdf'} 格式，最大 50MB
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Markdown 输入区域 */}
                {importType === 'markdown' && (
                    <div className="space-y-4">
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
                        disabled={
                            (importType === 'markdown' && !markdownContent.trim()) ||
                            ((importType === 'word' || importType === 'pdf') && !fileInputRef.current?.files?.[0])
                        }
                    >
                        {isLoading ? '导入中...' : '导入文档'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

