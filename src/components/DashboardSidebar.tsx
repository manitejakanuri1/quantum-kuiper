'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Home,
    Hammer,
    Users,
    UserCircle,
    Mic2,
    Brain,
    Wrench,
    BookOpen,
    BarChart3,
    Key,
    FileText,
    CreditCard,
    Settings,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Sparkles
} from 'lucide-react';

interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
}

interface NavSection {
    title?: string;
    items: NavItem[];
}

const navigation: NavSection[] = [
    {
        items: [
            { name: 'Home', href: '/dashboard', icon: Home },
            { name: 'Build', href: '/create', icon: Hammer },
        ]
    },
    {
        title: 'Library',
        items: [
            { name: 'Personas', href: '/dashboard/personas', icon: Users },
            { name: 'Avatars', href: '/dashboard/avatars', icon: UserCircle },
            { name: 'Voices', href: '/dashboard/voices', icon: Mic2 },
            { name: 'LLMs', href: '/dashboard/llms', icon: Brain, badge: 'Coming Soon' },
            { name: 'Tools', href: '/dashboard/tools', icon: Wrench, badge: 'Coming Soon' },
            { name: 'Knowledge', href: '/dashboard/knowledge', icon: BookOpen, badge: 'Coming Soon' },
        ]
    },
    {
        title: 'Analyse',
        items: [
            { name: 'Sessions', href: '/dashboard/sessions', icon: BarChart3 },
        ]
    },
    {
        title: 'Developers',
        items: [
            { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
            { name: 'Docs', href: '/dashboard/docs', icon: FileText },
        ]
    },
    {
        items: [
            { name: 'Subscription', href: '/dashboard/subscription', icon: CreditCard },
            { name: 'Settings', href: '/dashboard/settings', icon: Settings },
            { name: 'Feedback', href: '/dashboard/feedback', icon: MessageSquare },
        ]
    }
];

export function DashboardSidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut({ redirect: false });
        router.push('/auth/login');
    };

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard';
        }
        return pathname.startsWith(href);
    };

    return (
        <aside
            className={`fixed left-0 top-0 h-screen bg-black border-r border-white/5 flex flex-col transition-all duration-300 z-50 ${collapsed ? 'w-16' : 'w-56'
                }`}
        >
            {/* Header with name and collapse button */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <Link
                    href="/dashboard"
                    className="hover:opacity-80 transition-opacity"
                >
                    <span className="text-lg font-bold text-white whitespace-nowrap">Talk to Site</span>
                </Link>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2">
                {navigation.map((section, sectionIdx) => (
                    <div key={sectionIdx} className="mb-4">
                        {section.title && !collapsed && (
                            <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {section.title}
                            </h3>
                        )}
                        <ul className="space-y-1">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <li key={item.name}>
                                        <Link
                                            href={item.href}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${active
                                                ? 'bg-white/10 text-white'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            title={collapsed ? item.name : undefined}
                                        >
                                            <Icon className="w-5 h-5 flex-shrink-0" />
                                            {!collapsed && (
                                                <>
                                                    <span className="flex-1">{item.name}</span>
                                                    {item.badge && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 text-gray-400 rounded whitespace-nowrap">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* User Profile */}
            {session && (
                <div className="p-3 border-t border-white/10">
                    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                            <span className="text-black text-sm font-medium">
                                {session.user?.email?.[0]?.toUpperCase() || 'U'}
                            </span>
                        </div>
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {session.user?.name || session.user?.email?.split('@')[0] || 'User'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    {session.user?.email?.split('@')[0]}&apos;s Org
                                </p>
                            </div>
                        )}
                        {!collapsed && (
                            <button
                                onClick={handleSignOut}
                                className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                title="Sign out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}
