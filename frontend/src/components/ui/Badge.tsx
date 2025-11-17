import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md' | 'lg';
    dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', size = 'md', dot = false, children, ...props }, ref) => {
        const variants = {
            default: 'bg-gray-100 text-gray-800',
            primary: 'bg-blue-100 text-blue-800',
            success: 'bg-green-100 text-green-800',
            warning: 'bg-amber-100 text-amber-800',
            danger: 'bg-red-100 text-red-800',
            info: 'bg-purple-100 text-purple-800',
        };

        const sizes = {
            sm: 'px-2 py-0.5 text-xs',
            md: 'px-2.5 py-1 text-sm',
            lg: 'px-3 py-1.5 text-base',
        };

        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center gap-1.5 font-medium rounded-full',
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {dot && (
                    <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        variant === 'default' && 'bg-gray-500',
                        variant === 'primary' && 'bg-blue-500',
                        variant === 'success' && 'bg-green-500',
                        variant === 'warning' && 'bg-amber-500',
                        variant === 'danger' && 'bg-red-500',
                        variant === 'info' && 'bg-purple-500',
                    )} />
                )}
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';

