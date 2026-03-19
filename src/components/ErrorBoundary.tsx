'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    console.error('Error logged to service:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

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
                Oops! Something went wrong
              </h1>

              {/* Description */}
              <p className="mb-6 text-center text-text-secondary">
                We encountered an unexpected error. Don&apos;t worry, we&apos;ve been notified and are working on it.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 rounded-lg border border-border-default bg-bg-base p-4">
                  <p className="mb-2 font-mono text-sm text-error">
                    <strong>Error:</strong> {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="max-h-40 overflow-x-auto text-xs text-text-muted">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <button
                  onClick={this.handleReset}
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

    return this.props.children;
  }
}

// Loading Spinner Component
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-accent/20 border-t-accent`}
      />
    </div>
  );
}

// Loading State Component
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-text-secondary">{message}</p>
      </div>
    </div>
  );
}

// Skeleton Loader
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-bg-elevated ${className}`} />
  );
}
