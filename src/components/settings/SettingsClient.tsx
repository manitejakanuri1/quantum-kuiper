'use client';

import { useState } from 'react';
import { User, CreditCard, Key, Shield, LogOut } from 'lucide-react';
import { ProfileTab } from './ProfileTab';
import { BillingTab } from './BillingTab';
import { ApiKeysTab } from './ApiKeysTab';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface SettingsClientProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  plan: {
    name: string;
    label: string;
    queriesPerDay: number;
    maxWebsites: number;
    queriesToday: number;
  };
  usage: {
    totalQueries: number;
    totalConversations: number;
    totalTtsChars: number;
    totalCostCents: number;
    agentCount: number;
  };
}

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
  { id: 'api-keys', label: 'API Keys', icon: Key },
];

export function SettingsClient({ user, plan, usage }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-text-secondary">Manage your account, billing, and preferences.</p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 rounded-xl bg-bg-surface p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ProfileTab user={user} />}
      {activeTab === 'billing' && <BillingTab plan={plan} usage={usage} />}
      {activeTab === 'api-keys' && <ApiKeysTab />}

      {/* Danger Zone */}
      <div className="mt-12 rounded-xl border border-error/20 bg-error/5 p-6">
        <h3 className="mb-2 font-semibold text-error">Danger Zone</h3>
        <p className="mb-4 text-sm text-text-secondary">
          These actions are permanent and cannot be undone.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-error/30 hover:text-error"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
          <button
            className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/20"
            onClick={() => alert('Contact support@talktosite.com to delete your account.')}
          >
            <Shield className="h-4 w-4" />
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
