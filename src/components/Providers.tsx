'use client';

// Supabase Auth is cookie-based and doesn't require a context provider.
// This component is kept as a simple passthrough for any future providers
// (e.g., theme, toast notifications).

export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
