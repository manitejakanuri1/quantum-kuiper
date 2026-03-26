import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const ADMIN_EMAIL = 'manitejakanuri1@gmail.com';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/agents', label: 'Agents', icon: '🤖' },
  { href: '/admin/conversations', label: 'Conversations', icon: '💬' },
  { href: '/admin/health', label: 'System Health', icon: '🔋' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r border-border-default bg-bg-surface">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-border-default px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-sm">
            🛡️
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">Admin</p>
            <p className="text-[10px] text-text-muted">Talk to Site</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border-default p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-secondary"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
