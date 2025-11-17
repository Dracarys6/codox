import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className,
        variant = 'primary',
        size = 'md',
        isLoading = false,
        leftIcon,
        rightIcon,
        children,
        disabled,
        ...props
    }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg relative overflow-hidden';

        const variants = {
            primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95',
            secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
            danger: 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700 focus:ring-red-500 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95',
            ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
            outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-sm',
            lg: 'px-6 py-3 text-base',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-inherit">
                        <div className="icon-sm border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                <span className={cn('flex items-center gap-2', isLoading && 'opacity-0')}>
                    {leftIcon && <span className="icon-sm">{leftIcon}</span>}
                    {children}
                    {rightIcon && <span className="icon-sm">{rightIcon}</span>}
                </span>
            </button>
        );
    }
);

Button.displayName = 'Button';

