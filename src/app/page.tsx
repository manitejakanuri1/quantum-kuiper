'use client';

import Link from 'next/link';
import { Sparkles, Mic, Video, Globe, ArrowRight, Zap, Shield, Clock, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

// Animated particles background
function ParticleField() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white/20 animate-pulse"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// Floating orbs
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main glow orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[128px] opacity-40 animate-float" />
      <div className="absolute top-1/3 -right-32 w-80 h-80 bg-cyan-500 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-float-delayed" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-500 rounded-full mix-blend-screen filter blur-[100px] opacity-25 animate-float-slow" />
      <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[128px] opacity-30 animate-float-delayed" />
    </div>
  );
}

// Animated typing text
function TypewriterText({ texts }: { texts: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % texts.length);
        setIsVisible(true);
      }, 500);
    }, 3000);
    return () => clearInterval(interval);
  }, [texts.length]);

  return (
    <span className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {texts[currentIndex]}
    </span>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

   
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Dynamic background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950" />

      {mounted && (
        <>
          <FloatingOrbs />
          <ParticleField />
        </>
      )}

      {/* Grid overlay */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), 
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
        }}
      />

      <div className="relative">
        {/* Hero Section */}
        <div className="relative min-h-screen flex flex-col">
          {/* Nav */}
          <nav className="relative z-50 px-6 py-6 lg:px-16">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3 group cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all duration-500 group-hover:scale-110">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Talk to Site
                </span>
              </div>
              <div className="flex items-center gap-6">
                <Link
                  href="/auth/login"
                  className="text-gray-400 hover:text-white transition-colors duration-300 font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="relative group px-6 py-3 rounded-full overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 rounded-full" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span className="relative text-white font-semibold">Get Started</span>
                </Link>
              </div>
            </div>
          </nav>

          {/* Hero content */}
          <div className="flex-1 flex items-center justify-center px-6 lg:px-16">
            <div className="text-center max-w-5xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium mb-8 backdrop-blur-xl">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-gray-300">Now with Real-Time Lip-Sync Technology</span>
              </div>

              {/* Main heading */}
              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black mb-8 leading-[0.9] tracking-tight">
                <span className="text-white">Meet Your</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">
                  <TypewriterText texts={['AI Digital Twin', 'Voice Assistant', 'Sales Agent', 'Support Hero']} />
                </span>
              </h1>

              {/* Subheading */}
              <p className="text-xl sm:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
                Deploy hyper-realistic AI agents that see, speak, and understand.
                <span className="text-white font-medium"> Trained on your business in minutes.</span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Link
                  href="/auth/signup"
                  className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span className="relative text-white font-bold text-lg">Create Your Agent</span>
                  <ArrowRight className="relative w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="group inline-flex items-center gap-3 px-8 py-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                  <span className="text-white font-semibold">Watch Demo</span>
                </button>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1">500ms</div>
                  <div className="text-gray-500 text-sm">Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1">99.9%</div>
                  <div className="text-gray-500 text-sm">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1">50+</div>
                  <div className="text-gray-500 text-sm">Languages</div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
              <div className="w-1 h-2 bg-white/60 rounded-full animate-scroll" />
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="relative py-32 px-6 lg:px-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                Built for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Future</span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Enterprise-grade AI meets stunning visual design
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Video, title: 'Real-Time Faces', desc: 'Photorealistic lip-sync with emotional expressions', color: 'from-purple-500 to-purple-600' },
                { icon: Mic, title: 'Voice Intelligence', desc: 'Natural conversations with instant understanding', color: 'from-pink-500 to-pink-600' },
                { icon: Globe, title: 'Website Trained', desc: 'Learns your business from your content automatically', color: 'from-cyan-500 to-cyan-600' },
                { icon: Zap, title: 'Lightning Fast', desc: 'Sub-500ms response for seamless interactions', color: 'from-amber-500 to-orange-600' },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:border-white/20 hover:bg-white/[0.05] transition-all duration-500"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative py-32 px-6 lg:px-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 mb-8">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-300">Start for free, upgrade anytime</span>
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Ready to transform your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
                customer experience?
              </span>
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Join hundreds of businesses using Talk to Site to automate support,
              generate leads, and delight customers 24/7.
            </p>
            <Link
              href="/auth/signup"
              className="group relative inline-flex items-center gap-3 px-12 py-6 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600" />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="relative text-white font-bold text-xl">Start Building Now</span>
              <ArrowRight className="relative w-6 h-6 text-white group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative py-12 px-6 lg:px-16 border-t border-white/5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-500">Talk to Site</span>
            </div>
            <p className="text-gray-600 text-sm">
              © 2026 Talk to Site. Powered by AI.
            </p>
          </div>
        </footer>
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-30px) translateX(15px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(-10px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-40px) translateX(20px); }
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes scroll {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.5; transform: translateY(4px); }
        }
        .animate-float { animation: float 8s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 10s ease-in-out infinite; animation-delay: 2s; }
        .animate-float-slow { animation: float-slow 12s ease-in-out infinite; }
        .animate-gradient { background-size: 200% auto; animation: gradient 4s linear infinite; }
        .animate-scroll { animation: scroll 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
