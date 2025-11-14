import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({
        className,
        label,
        error,
        helperText,
        leftIcon,
        rightIcon,
        fullWidth = false,
        type = 'text',
        disabled,
        ...props
    }, ref) => {
        const [isFocused, setIsFocused] = useState(false);
        const [showPassword, setShowPassword] = useState(false);

        const isPasswordType = type === 'password';
        const actualType = isPasswordType && showPassword ? 'text' : type;

        return (
            <div className={cn('flex flex-col', fullWidth && 'w-full')}>
                {label && (
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        type={actualType}
                        className={cn(
                            'block w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
                            'text-gray-900 placeholder-gray-400 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-offset-0',
                            leftIcon && 'pl-10',
                            (rightIcon || isPasswordType) && 'pr-10',
                            error
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50'
                                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100 bg-gray-50 focus:bg-white',
                            disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
                            isFocused && !error && 'shadow-lg',
                            className
                        )}
                        disabled={disabled}
                        onFocus={(e) => {
                            setIsFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            props.onBlur?.(e);
                        }}
                        {...props}
                    />
                    {isPasswordType && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showPassword ? (
                                <svg className="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            ) : (
                                <svg className="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                            )}
                        </button>
                    )}
                    {rightIcon && !isPasswordType && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {(error || helperText) && (
                    <p className={cn(
                        'mt-1.5 text-sm',
                        error ? 'text-red-600 font-medium' : 'text-gray-500'
                    )}>
                        {error || helperText}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

