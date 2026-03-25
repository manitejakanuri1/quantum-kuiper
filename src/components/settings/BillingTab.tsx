'use client';

import { Bot, MessageSquare, Volume2, DollarSign, Zap, ArrowUpRight } from 'lucide-react';

interface BillingTabProps {
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

const planPrices: Record<string, number> = {
  starter: 0,
  growth: 39,
  professional: 79,
  business: 199,
  enterprise: 499,
};

export function BillingTab({ plan, usage }: BillingTabProps) {
  const price = planPrices[plan.name] || 0;
  const usagePercent = plan.queriesPerDay > 0
    ? Math.min((plan.queriesToday / plan.queriesPerDay) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-text-primary">{plan.label} Plan</h2>
            </div>
            <p className="text-sm text-text-secondary">
              {price === 0 ? 'Free forever' : `$${price}/month`}
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/#pricing'}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Upgrade
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Plan Limits */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-bg-surface p-3">
            <p className="text-xs text-text-muted">Queries Today</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {plan.queriesToday} <span className="text-sm text-text-muted">/ {plan.queriesPerDay}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-base">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg bg-bg-surface p-3">
            <p className="text-xs text-text-muted">Active Agents</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {usage.agentCount} <span className="text-sm text-text-muted">/ {plan.maxWebsites}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-base">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min((usage.agentCount / plan.maxWebsites) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Usage Stats (Last 30 Days) */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Usage (Last 30 Days)</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={MessageSquare}
            label="Queries"
            value={usage.totalQueries.toLocaleString()}
          />
          <StatCard
            icon={Bot}
            label="Conversations"
            value={usage.totalConversations.toLocaleString()}
          />
          <StatCard
            icon={Volume2}
            label="TTS Characters"
            value={formatNumber(usage.totalTtsChars)}
          />
          <StatCard
            icon={DollarSign}
            label="Est. Cost"
            value={`$${(usage.totalCostCents / 100).toFixed(2)}`}
          />
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Compare Plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="pb-3 font-medium text-text-muted">Feature</th>
                <th className="pb-3 font-medium text-text-muted">Starter</th>
                <th className="pb-3 font-medium text-text-muted">Growth</th>
                <th className="pb-3 font-medium text-text-muted">Scale</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              <tr className="border-b border-border-default/50">
                <td className="py-3">Price</td>
                <td className="py-3 text-text-primary">Free</td>
                <td className="py-3 text-text-primary">$39/mo</td>
                <td className="py-3 text-text-primary">$99/mo</td>
              </tr>
              <tr className="border-b border-border-default/50">
                <td className="py-3">Agents</td>
                <td className="py-3">1</td>
                <td className="py-3">3</td>
                <td className="py-3">10</td>
              </tr>
              <tr className="border-b border-border-default/50">
                <td className="py-3">Queries/Day</td>
                <td className="py-3">30</td>
                <td className="py-3">150</td>
                <td className="py-3">1,000</td>
              </tr>
              <tr className="border-b border-border-default/50">
                <td className="py-3">Custom Voice</td>
                <td className="py-3 text-text-muted">—</td>
                <td className="py-3 text-accent">✓</td>
                <td className="py-3 text-accent">✓</td>
              </tr>
              <tr>
                <td className="py-3">Custom Avatar</td>
                <td className="py-3 text-text-muted">—</td>
                <td className="py-3 text-accent">✓</td>
                <td className="py-3 text-accent">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-base p-4">
      <Icon className="mb-2 h-5 w-5 text-text-muted" />
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
