import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
    options: Array<{ value: string | number; label: string; disabled?: boolean }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({
        className,
        label,
        error,
        helperText,
        fullWidth = false,
        options,
        disabled,
        ...props
    }, ref) => {
        return (
            <div className={cn('flex flex-col', fullWidth && 'w-full')}>
                {label && (
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <div className="relative">
                    <select
                        ref={ref}
                        className={cn(
                            'block w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
                            'text-gray-900 text-sm appearance-none bg-gray-50',
                            'focus:outline-none focus:ring-2 focus:ring-offset-0',
                            error
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50'
                                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100 focus:bg-white',
                            disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
                            className
                        )}
                        disabled={disabled}
                        {...props}
                    >
                        {options.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg
                            className="w-3 h-3 min-w-[0.75rem] text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </div>
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

Select.displayName = 'Select';

