import { ReactNode } from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <div className="relative z-10 flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1 py-10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: '1120px' }}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

