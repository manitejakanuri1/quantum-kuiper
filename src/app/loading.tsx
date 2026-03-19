'use client';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="h-20 w-20 animate-pulse rounded-full bg-gradient-to-r from-accent via-purple to-cyan" />
            <div className="absolute inset-0 h-20 w-20 animate-pulse rounded-full bg-gradient-to-r from-accent via-purple to-cyan opacity-50 blur-xl" />
          </div>
        </div>

        {/* Spinner */}
        <div className="mb-4 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
        </div>

        {/* Text */}
        <p className="animate-pulse text-lg font-medium text-text-secondary">
          Loading...
        </p>

        {/* Dots Animation */}
        <div className="mt-4 flex justify-center gap-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-purple" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-cyan" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
