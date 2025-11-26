import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';

interface NavItem {
    label: string;
    to: string;
    icon: JSX.Element;
    exact?: boolean;
}

const navItems: NavItem[] = [
    {
        label: '主页',
        to: '/',
        exact: true,
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9.75L12 4l9 5.75M5 10.75v8.5A1.75 1.75 0 006.75 21h10.5A1.75 1.75 0 0019 19.25v-8.5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21V12h6v9" />
            </svg>
        ),
    },
    {
        label: '最近文档',
        to: '/documents?tab=recent',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l3 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        label: '收藏',
        to: '/documents?tab=favorites',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.499a1.75 1.75 0 011.04 0l6.518 2.13a1.75 1.75 0 011.204 1.664v9.414a1.75 1.75 0 01-1.204 1.664l-6.518 2.13a1.75 1.75 0 01-1.04 0l-6.518-2.13A1.75 1.75 0 013 16.707V7.293a1.75 1.75 0 011.204-1.664l6.518-2.13z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.75 12.75l2.25 2 4.25-4.5" />
            </svg>
        ),
    },
    {
        label: '回收站',
        to: '/documents?tab=trash',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4h6m-8 3h10M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1m4 3v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7h14z" />
            </svg>
        ),
    },
];

export function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isScrolled, setIsScrolled] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 8);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setShowUserMenu(false);
        setMobileMenuOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUserMenu]);

    const adminNavItem: NavItem | null =
        user?.role === 'admin'
            ? {
                  label: '用户管理',
                  to: '/admin/users',
                  icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1"
                          />
                      </svg>
                  ),
              }
            : null;

    const computedNavItems = adminNavItem ? [...navItems, adminNavItem] : navItems;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (item: NavItem) => {
        if (item.exact) {
            return location.pathname === item.to;
        }
        if (item.to.startsWith('/documents')) {
            return location.pathname.startsWith('/documents');
        }
        return location.pathname.startsWith(item.to);
    };

    return (
        <header
            className={`sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl transition-all duration-300 ${
                isScrolled ? 'shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)]' : ''
            }`}
        >
            <div
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
                style={{ width: '100%', maxWidth: '1120px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}
            >
                <div className="flex items-center justify-between gap-6 py-3">
                    <div className="flex items-center gap-10 flex-1 min-w-0">
                        <Link to="/" className="flex items-center gap-3 text-slate-900 font-semibold text-lg">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <span className="hidden sm:block text-[20px] font-bold tracking-wide">Codox</span>
                        </Link>

                        {user && (
                            <nav className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-600">
                                {computedNavItems.map((item) => (
                                    <Link
                                        key={item.label}
                                        to={item.to}
                                        className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                                            isActive(item)
                                                ? 'text-blue-600 bg-blue-50 border border-blue-100 shadow-sm'
                                                : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 border border-transparent'
                                        }`}
                                    >
                                        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${isActive(item) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        )}
                    </div>

                    {user ? (
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => navigate('/search')}
                                className="hidden lg:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-600 shadow-inner transition hover:border-blue-300 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-4.15a6 6 0 11-12 0 6 6 0 0112 0z" />
                                </svg>
                                搜索文档
                            </button>
                            <button
                                onClick={() => navigate('/docs/new')}
                                className="hidden md:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-0.5 hover:shadow-xl"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                                </svg>
                                新建文档
                            </button>

                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setShowUserMenu((prev) => !prev)}
                                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
                                >
                                    <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                                        {user.profile.avatar_url ? (
                                            <img src={user.profile.avatar_url} alt={user.profile.nickname || user.email} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-semibold text-blue-600">
                                                {(user.profile.nickname || user.email).charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </span>
                                    <div className="hidden sm:block text-left">
                                        <div className="text-sm font-semibold text-slate-800 truncate max-w-[140px]">
                                            {user.profile.nickname || user.email.split('@')[0]}
                                        </div>
                                        <div className="text-xs text-slate-500">在线</div>
                                    </div>
                                    <svg className={`h-4 w-4 text-slate-400 transition ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {showUserMenu && (
                                    <div className="absolute right-0 mt-3 w-60 origin-top-right rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-2xl backdrop-blur">
                                        <div className="rounded-xl bg-slate-50/70 px-4 py-3">
                                            <p className="text-sm font-semibold text-slate-900">{user.email}</p>
                                            <p className="text-xs text-slate-500">欢迎回来！</p>
                                        </div>
                                        <div className="py-1 text-sm text-slate-600">
                                            <Link
                                                to="/profile"
                                                onClick={() => setShowUserMenu(false)}
                                                className="flex items-center gap-2 rounded-lg px-4 py-2 transition hover:bg-blue-50 hover:text-blue-600"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A6 6 0 1118.88 6.196M15 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                                </svg>
                                                个人资料
                                            </Link>
                                            <Link
                                                to="/documents"
                                                onClick={() => setShowUserMenu(false)}
                                                className="flex items-center gap-2 rounded-lg px-4 py-2 transition hover:bg-blue-50 hover:text-blue-600"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 11h12M8 15h12M4 7h.01M4 11h.01M4 15h.01" />
                                                </svg>
                                                我的文档
                                            </Link>
                                            {user.role === 'admin' && (
                                                <Link
                                                    to="/admin/users"
                                                    onClick={() => setShowUserMenu(false)}
                                                    className="flex items-center gap-2 rounded-lg px-4 py-2 transition hover:bg-blue-50 hover:text-blue-600"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 11a4 4 0 100-8 4 4 0 000 8zm0 0v10m-7 0h14m-5-5a3 3 0 016 0"
                                                        />
                                                    </svg>
                                                    用户管理
                                                </Link>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="mt-1 flex w-full items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 11-4 0v-1m4-10V5a2 2 0 10-4 0v1" />
                                            </svg>
                                            退出登录
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setMobileMenuOpen((prev) => !prev)}
                                className="md:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-blue-200 hover:text-blue-600"
                                aria-label="Toggle navigation"
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link
                                to="/login"
                                className="px-5 py-2.5 text-base font-semibold text-slate-600 hover:text-blue-600"
                            >
                                登录
                            </Link>
                            <Link
                                to="/register"
                                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                            >
                                注册
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {user && mobileMenuOpen && (
                <div className="md:hidden border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 shadow-inner">
                    <div className="space-y-3">
                        <div className="grid gap-2">
                            {computedNavItems.map((item) => (
                                <Link
                                    key={item.label}
                                    to={item.to}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                                        isActive(item)
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                                    }`}
                                >
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${isActive(item) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                        <button
                            onClick={() => navigate('/docs/new')}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                            </svg>
                            新建文档
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}

