'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Bot, Settings, User } from 'lucide-react';

const tabs = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Agents', href: '/dashboard/agents', icon: Bot },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Profile', href: '/dashboard/profile', icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-default bg-bg-surface md:hidden">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                active ? 'text-accent' : 'text-text-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
