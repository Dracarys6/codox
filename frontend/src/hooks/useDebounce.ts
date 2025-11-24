import { useEffect, useState } from 'react';

/**
 * 简单的防抖 Hook，用于在输入场景避免频繁触发请求。
 */
export function useDebounce<T>(value: T, delay = 400): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}


