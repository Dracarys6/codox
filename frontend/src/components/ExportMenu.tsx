import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import apiClient from '../api/client';
import { toast } from './ui/Toast';

interface ExportMenuProps {
    docId: number;
    docTitle?: string;
    variant?: 'button' | 'dropdown';
}

type ExportFormat = 'word' | 'pdf' | 'markdown';

export function ExportMenu({ docId, docTitle, variant = 'button' }: ExportMenuProps) {
    const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 处理导出
    const handleExport = async (format: ExportFormat) => {
        setIsExporting(format);
        setShowDropdown(false);

        try {
            let filename: string;
            let mimeType: string;
            let blob: Blob;

            if (format === 'word') {
                const result = await apiClient.exportWord(docId);
                filename = result.filename || `${docTitle || 'document'}.docx`;
                mimeType =
                    result.mime_type ||
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                blob = result.blob;
            } else if (format === 'pdf') {
                const result = await apiClient.exportPdf(docId);
                filename = result.filename || `${docTitle || 'document'}.pdf`;
                mimeType = result.mime_type || 'application/pdf';
                blob = result.blob;
            } else {
                // Markdown 仍然使用 JSON 文本返回
                const result = await apiClient.exportMarkdown(docId);
                filename = result.filename || `${docTitle || 'document'}.md`;
                mimeType = result.mime_type || 'text/markdown';
                blob = new Blob([result.markdown], { type: mimeType });
            }

            // 统一的下载逻辑：通过 Blob 触发浏览器下载
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`${format.toUpperCase()} 导出成功！`);
        } catch (error: any) {
            console.error('导出失败:', error);
            toast.error(error?.response?.data?.error || error?.message || '导出失败，请重试');
        } finally {
            setIsExporting(null);
        }
    };

    // 点击外部关闭下拉菜单
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setShowDropdown(false);
        }
    };

    // 监听点击外部事件
    useEffect(() => {
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showDropdown]);

    if (variant === 'dropdown') {
        return (
            <div className="relative" ref={dropdownRef}>
                <Button
                    variant="outline"
                    onClick={() => setShowDropdown(!showDropdown)}
                    rightIcon={
                        <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    }
                >
                    导出
                </Button>
                {showDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="py-1">
                            <button
                                onClick={() => handleExport('word')}
                                disabled={isExporting !== null}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExporting === 'word' ? (
                                    <div className="icon-sm border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <span>📄</span>
                                )}
                                <span>导出为 Word</span>
                            </button>
                            <button
                                onClick={() => handleExport('pdf')}
                                disabled={isExporting !== null}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExporting === 'pdf' ? (
                                    <div className="icon-sm border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <span>📕</span>
                                )}
                                <span>导出为 PDF</span>
                            </button>
                            <button
                                onClick={() => handleExport('markdown')}
                                disabled={isExporting !== null}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExporting === 'markdown' ? (
                                    <div className="icon-sm border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <span>📝</span>
                                )}
                                <span>导出为 Markdown</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 按钮模式：显示三个独立的按钮
    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('word')}
                isLoading={isExporting === 'word'}
                disabled={isExporting !== null}
                leftIcon={<span>📄</span>}
            >
                Word
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                isLoading={isExporting === 'pdf'}
                disabled={isExporting !== null}
                leftIcon={<span>📕</span>}
            >
                PDF
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('markdown')}
                isLoading={isExporting === 'markdown'}
                disabled={isExporting !== null}
                leftIcon={<span>📝</span>}
            >
                Markdown
            </Button>
        </div>
    );
}

