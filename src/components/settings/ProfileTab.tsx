'use client';

import { useState } from 'react';
import { Save, Loader2, Check, Mail, Calendar, User } from 'lucide-react';

interface ProfileTabProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    createdAt: string;
  };
}

export function ProfileTab({ user }: ProfileTabProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-6">
        <h2 className="mb-6 text-lg font-semibold text-text-primary">Profile Information</h2>

        <div className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
              <User className="h-8 w-8" />
            </div>
            <div>
              <p className="font-medium text-text-primary">{user.fullName || 'No name set'}</p>
              <p className="text-sm text-text-muted">{user.email}</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-border-default bg-bg-base px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Email</label>
            <div className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-base/50 px-4 py-2.5 text-text-muted">
              <Mail className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">Email cannot be changed. Contact support if needed.</p>
          </div>

          {/* Member Since */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Member Since</label>
            <div className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-base/50 px-4 py-2.5 text-text-muted">
              <Calendar className="h-4 w-4" />
              <span>{memberSince}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || fullName === user.fullName}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Password Change */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Password</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Change your password or request a password reset link.
        </p>
        <button
          onClick={() => window.location.href = '/auth/forgot-password'}
          className="rounded-lg border border-border-default bg-bg-elevated px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
        >
          Reset Password
        </button>
      </div>
    </div>
  );
}
