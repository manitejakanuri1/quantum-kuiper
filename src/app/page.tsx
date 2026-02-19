'use client';

import Link from 'next/link';
import { Sparkles, Mic, Video, Globe, ArrowRight, Zap, Play } from 'lucide-react';
import { useEffect, useState, memo, useMemo } from 'react';

// Memoized particle component for better performance
const ParticleField = memo(function ParticleField() {
  const particles = useMemo(() => {
    // Generate particles once, no state needed
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: 'layout style paint' }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white/10 animate-pulse"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: 'translateZ(0)', // Force GPU layer
          }}
        />
      ))}
    </div>
  );
});

// Optimized floating orbs with reduced blur
const FloatingOrbs = memo(function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: 'layout style paint' }}>
      <div
        className="absolute top-1/4 -left-32 w-64 h-64 bg-purple-600 rounded-full mix-blend-screen opacity-20 animate-float"
        style={{ filter: 'blur(40px)', transform: 'translateZ(0)' }}
      />
      <div
        className="absolute top-1/3 -right-32 w-64 h-64 bg-cyan-500 rounded-full mix-blend-screen opacity-15 animate-float-delayed"
        style={{ filter: 'blur(40px)', transform: 'translateZ(0)' }}
      />
    </div>
  );
});

// Optimized typewriter with reduced re-renders
const TypewriterText = memo(function TypewriterText({ texts }: { texts: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % texts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [texts.length]);

  return (
    <span className="transition-opacity duration-300">
      {texts[currentIndex]}
    </span>
  );
});

// Memoized feature card
const FeatureCard = memo(function FeatureCard({
  Icon,
  title,
  desc,
  color
}: {
  Icon: any;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
});

export default function HomePage() {
  const [animationsReady, setAnimationsReady] = useState(false);

  useEffect(() => {
    // Use requestIdleCallback for non-critical animations
    const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;
    const timer = hasIdleCallback
      ? window.requestIdleCallback(() => setAnimationsReady(true))
      : (setTimeout(() => setAnimationsReady(true), 500) as unknown as number);

    return () => {
      if (hasIdleCallback) {
        window.cancelIdleCallback(timer);
      } else {
        clearTimeout(timer);
      }
    };
  }, []);

  const features = useMemo(() => [
    { Icon: Video, title: 'Real-Time Faces', desc: 'Photorealistic lip-sync with emotional expressions', color: 'from-purple-500 to-purple-600' },
    { Icon: Mic, title: 'Voice Intelligence', desc: 'Natural conversations with instant understanding', color: 'from-pink-500 to-pink-600' },
    { Icon: Globe, title: 'Website Trained', desc: 'Learns your business from your content automatically', color: 'from-cyan-500 to-cyan-600' },
    { Icon: Zap, title: 'Lightning Fast', desc: 'Sub-500ms response for seamless interactions', color: 'from-amber-500 to-orange-600' },
  ], []);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Static background - no animations */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950" style={{ contain: 'layout style paint' }} />

      {/* Load animations after idle */}
      {animationsReady && (
        <>
          <FloatingOrbs />
          <ParticleField />
        </>
      )}

      {/* Grid overlay - simplified */}
      <div
        className="fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
          contain: 'layout style paint',
        }}
      />

      <div className="relative">
        {/* Hero Section */}
        <div className="relative min-h-screen flex flex-col">
          {/* Nav - optimized */}
          <nav className="relative z-50 px-6 py-4 lg:px-16">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Talk to Site
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/auth/login"
                  className="text-gray-400 hover:text-white transition-colors duration-200 font-medium text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="relative px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </nav>

          {/* Hero content */}
          <div className="flex-1 flex items-center justify-center px-6 lg:px-16 py-12">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge - simplified */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium mb-6 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-gray-300 text-xs">Real-Time Lip-Sync Technology</span>
              </div>

              {/* Main heading - simplified */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black mb-6 leading-tight">
                <span className="text-white">Meet Your</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  <TypewriterText texts={['AI Digital Twin', 'Voice Assistant', 'Sales Agent']} />
                </span>
              </h1>

              {/* Subheading */}
              <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                Deploy hyper-realistic AI agents that see, speak, and understand.
                <span className="text-white font-medium"> Trained on your business in minutes.</span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 text-white font-bold hover:opacity-90 transition-opacity"
                >
                  Create Your Agent
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white font-semibold">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Play className="w-3 h-3 text-white ml-0.5" />
                  </div>
                  Watch Demo
                </button>
              </div>

              {/* Stats - simplified */}
              <div className="flex flex-wrap items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">500ms</div>
                  <div className="text-gray-500 text-xs">Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">99.9%</div>
                  <div className="text-gray-500 text-xs">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">50+</div>
                  <div className="text-gray-500 text-xs">Languages</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section - simplified */}
        <div className="relative py-20 px-6 lg:px-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                Built for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Future</span>
              </h2>
              <p className="text-lg text-gray-400">
                Enterprise-grade AI meets stunning design
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, i) => (
                <FeatureCard key={i} {...feature} />
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section - simplified */}
        <div className="relative py-20 px-6 lg:px-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Ready to transform your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
                customer experience?
              </span>
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              Join hundreds of businesses using Talk to Site to automate support and delight customers 24/7.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-10 py-5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 text-white font-bold text-lg hover:opacity-90 transition-opacity"
            >
              Start Building Now
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Optimized animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0) translateZ(0); }
          50% { transform: translateY(-20px) translateX(10px) translateZ(0); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) translateX(0) translateZ(0); }
          50% { transform: translateY(-15px) translateX(-8px) translateZ(0); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite; animation-delay: 1s; }
      `}</style>
    </div>
  );
}
