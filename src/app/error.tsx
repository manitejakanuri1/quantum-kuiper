'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base p-6">
      <div className="w-full max-w-2xl">
        {/* Error Card */}
        <div className="glass rounded-2xl border border-error/20 p-8 shadow-2xl">
          {/* Icon */}
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error/10">
              <AlertTriangle className="h-10 w-10 text-error" />
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-4 text-center text-3xl font-bold text-text-primary">
            Something went wrong!
          </h1>

          {/* Description */}
          <p className="mb-6 text-center text-text-secondary">
            We encountered an unexpected error. Our team has been notified and is working on a fix.
          </p>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 rounded-lg border border-border-default bg-bg-base p-4">
              <p className="mb-2 font-mono text-sm text-error">
                <strong>Error:</strong> {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-text-muted">
                  <strong>Digest:</strong> {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <button
              onClick={reset}
              className="glow-accent flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <RefreshCw className="h-5 w-5" />
              Try Again
            </button>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-xl border border-border-default bg-bg-elevated px-6 py-3 font-semibold text-text-primary transition-colors hover:border-border-hover hover:bg-bg-surface"
            >
              <Home className="h-5 w-5" />
              Go Home
            </Link>
          </div>

          {/* Support Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-text-muted">
              Need help?{' '}
              <a href="mailto:support@talktosite.com" className="text-accent transition-colors hover:text-accent-hover">
                Contact Support
              </a>
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="glass mt-6 rounded-xl p-4">
          <h3 className="mb-2 font-semibold text-text-primary">Quick Tips:</h3>
          <ul className="space-y-1 text-sm text-text-secondary">
            <li>• Try refreshing the page</li>
            <li>• Clear your browser cache</li>
            <li>• Check your internet connection</li>
            <li>• Try again in a few minutes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
