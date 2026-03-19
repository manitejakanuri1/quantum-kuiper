'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Plan } from '@/lib/types';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: Home },
  { name: 'Agents', href: '/dashboard/agents', icon: Bot },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface SidebarProps {
  userEmail?: string;
  plan?: Plan;
  queriesToday?: number;
  queryLimit?: number;
}

export function DashboardSidebar({ userEmail, plan = 'starter', queriesToday = 0, queryLimit = 30 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] signOut:', e);
    }
    router.push('/auth/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const usagePercent = queryLimit > 0 ? Math.min((queriesToday / queryLimit) * 100, 100) : 0;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <aside
      className={`fixed left-0 top-0 z-50 hidden h-screen flex-col border-r border-border-default bg-bg-surface transition-all duration-300 md:flex ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default p-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <span className="text-base font-bold text-text-primary">Talk to Site</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Plan badge + usage */}
      {!collapsed && (
        <div className="border-b border-border-default px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
              {planLabel} Plan
            </span>
            <span className="text-xs tabular-nums text-text-muted">
              {queriesToday}/{queryLimit}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent > 80 ? 'bg-warning' : 'bg-accent'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-text-muted">Queries today</p>
        </div>
      )}

      {/* New Agent Button */}
      <div className="p-3">
        <Link
          href="/dashboard/agents/new"
          className={`flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>New Agent</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                    active
                      ? 'border-l-2 border-accent bg-accent-muted text-text-primary'
                      : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile & Sign Out */}
      <div className="border-t border-border-default p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent">
            <span className="text-sm font-medium text-white">
              {userEmail?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {userEmail?.split('@')[0] || 'User'}
                </p>
                <p className="truncate text-xs text-text-muted">{userEmail}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
