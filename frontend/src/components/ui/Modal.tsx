import { ReactNode, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    footer?: ReactNode;
}

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md',
    showCloseButton = true,
    footer,
}: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-full mx-4',
    };

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className={cn(
                        'relative bg-white rounded-2xl shadow-2xl w-full transform transition-all animate-scale-in',
                        sizeClasses[size]
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div className="flex-1">
                                {title && (
                                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                                )}
                                {description && (
                                    <p className="mt-1 text-sm text-gray-600">{description}</p>
                                )}
                            </div>
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <svg className="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {children}
                    </div>

                    {/* Footer */}
                    {footer && (
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
    isLoading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = '确认',
    cancelText = '取消',
    variant = 'primary',
    isLoading = false,
}: ConfirmModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="py-4">
                <p className="text-gray-700">{message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={isLoading}
                >
                    {cancelText}
                </Button>
                <Button
                    variant={variant === 'danger' ? 'danger' : 'primary'}
                    onClick={onConfirm}
                    isLoading={isLoading}
                >
                    {confirmText}
                </Button>
            </div>
        </Modal>
    );
}

