'use client';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 animate-pulse" />
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 blur-xl animate-pulse opacity-50" />
          </div>
        </div>

        {/* Spinner */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 border-4 border-purple-600/20 border-t-purple-600 rounded-full animate-spin" />
        </div>

        {/* Text */}
        <p className="text-gray-400 text-lg font-medium animate-pulse">
          Loading...
        </p>

        {/* Dots Animation */}
        <div className="flex gap-1 justify-center mt-4">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
