'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'checking' | 'healthy' | 'degraded' | 'down';
  latency?: number;
  details?: string;
}

export default function AdminHealthPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Supabase Database', status: 'checking' },
    { name: 'Supabase Auth', status: 'checking' },
    { name: 'Fish Audio TTS', status: 'checking' },
    { name: 'Simli Avatar', status: 'checking' },
    { name: 'Pinecone Vector DB', status: 'checking' },
    { name: 'Upstash Redis', status: 'checking' },
    { name: 'Google Gemini AI', status: 'checking' },
  ]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkHealth = async () => {
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as const })));

    const results = await fetch('/api/admin/health').then(r => r.json());
    setServices(results.services);
    setLastChecked(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const downCount = services.filter(s => s.status === 'down').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">System Health</h1>
          <p className="text-sm text-text-secondary">
            {lastChecked ? `Last checked: ${lastChecked}` : 'Checking...'}
          </p>
        </div>
        <button
          onClick={checkHealth}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
          <p className="text-xs text-text-muted">Healthy</p>
          <p className="text-3xl font-bold text-green-400">{healthyCount}</p>
        </div>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
          <p className="text-xs text-text-muted">Degraded</p>
          <p className="text-3xl font-bold text-yellow-400">{degradedCount}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-xs text-text-muted">Down</p>
          <p className="text-3xl font-bold text-red-400">{downCount}</p>
        </div>
      </div>

      {/* Service List */}
      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.name}
            className={`flex items-center justify-between rounded-xl border p-4 ${
              service.status === 'healthy' ? 'border-green-500/20 bg-bg-surface' :
              service.status === 'degraded' ? 'border-yellow-500/20 bg-yellow-500/5' :
              service.status === 'down' ? 'border-red-500/20 bg-red-500/5' :
              'border-border-default bg-bg-surface'
            }`}
          >
            <div className="flex items-center gap-3">
              {service.status === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-text-muted" />}
              {service.status === 'healthy' && <CheckCircle className="h-5 w-5 text-green-400" />}
              {service.status === 'degraded' && <AlertCircle className="h-5 w-5 text-yellow-400" />}
              {service.status === 'down' && <XCircle className="h-5 w-5 text-red-400" />}
              <div>
                <p className="text-sm font-medium text-text-primary">{service.name}</p>
                {service.details && (
                  <p className="text-xs text-text-muted">{service.details}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              {service.latency !== undefined && (
                <p className={`text-sm font-medium ${
                  service.latency < 500 ? 'text-green-400' :
                  service.latency < 2000 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {service.latency}ms
                </p>
              )}
              <p className={`text-xs capitalize ${
                service.status === 'healthy' ? 'text-green-400' :
                service.status === 'degraded' ? 'text-yellow-400' :
                service.status === 'down' ? 'text-red-400' :
                'text-text-muted'
              }`}>
                {service.status}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Environment Info */}
      <div className="rounded-xl border border-border-default bg-bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Environment</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-bg-elevated px-3 py-2">
            <p className="text-xs text-text-muted">Runtime</p>
            <p className="text-text-primary">Next.js 16.1.1 (Turbopack)</p>
          </div>
          <div className="rounded-lg bg-bg-elevated px-3 py-2">
            <p className="text-xs text-text-muted">Hosting</p>
            <p className="text-text-primary">Vercel</p>
          </div>
          <div className="rounded-lg bg-bg-elevated px-3 py-2">
            <p className="text-xs text-text-muted">Database</p>
            <p className="text-text-primary">Supabase (Postgres)</p>
          </div>
          <div className="rounded-lg bg-bg-elevated px-3 py-2">
            <p className="text-xs text-text-muted">Cache</p>
            <p className="text-text-primary">Upstash Redis</p>
          </div>
        </div>
      </div>
    </div>
  );
}
