'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useRef, useCallback, useState, useEffect } from 'react';

const AVATARS = [
  { src: '/faces/tina.png', name: 'Tina', role: 'Sales Agent' },
  { src: '/faces/sabour.png', name: 'Sabour', role: 'Customer Support' },
  { src: '/faces/doctor.png', name: 'Doctor', role: 'Knowledge Expert' },
  { src: '/faces/mark.png', name: 'Mark', role: 'Negotiator' },
];

export function Hero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile || !stageRef.current) return;
    if (rafRef.current) return; // throttle to rAF
    rafRef.current = requestAnimationFrame(() => {
      const rect = stageRef.current!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const x = ((e.clientY - cy) / (rect.height / 2)) * -4;
      const y = ((e.clientX - cx) / (rect.width / 2)) * 4;
      setTilt({ x, y });
      rafRef.current = null;
    });
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const central = AVATARS[0];
  const orbiting = AVATARS.slice(1);

  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16 lg:pt-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — copy */}
        <div>
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5 text-xs font-medium text-text-secondary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            AI Voice Agents — No Code Required
          </div>

          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
            Your Website Already Knows the Answers.{' '}
            <span className="animate-gradient-text">Now It Can Speak Them.</span>
          </h1>

          <p className="mb-8 max-w-lg text-lg leading-relaxed text-text-secondary">
            Paste your URL. Get an AI voice agent with a real talking face that knows everything
            about your business. Live in 5 minutes.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/signup"
              className="glow-accent inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_50px_rgba(59,130,246,0.3)]"
            >
              Create Your Agent
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-surface px-7 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:border-border-hover hover:bg-bg-elevated"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Watch Demo
            </a>
          </div>

          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-muted">
            <span>Works with any website</span>
            <span className="hidden sm:inline">·</span>
            <span>E-commerce</span>
            <span>·</span>
            <span>Restaurants</span>
            <span>·</span>
            <span>Law Firms</span>
            <span>·</span>
            <span>SaaS</span>
            <span>·</span>
            <span>Healthcare</span>
          </div>
        </div>

        {/* Right — 3D Avatar Stage */}
        <div
          className="flex justify-center lg:justify-end"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div
            ref={stageRef}
            className="perspective-container relative h-[420px] w-full max-w-[480px] sm:h-[480px]"
          >
            {/* Background gradient orbs */}
            <div className="animate-pulse-glow pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.15),transparent_70%)]" />
            <div className="animate-pulse-glow pointer-events-none absolute right-0 top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.12),transparent_70%)]" style={{ animationDelay: '2s' }} />
            <div className="animate-pulse-glow pointer-events-none absolute bottom-10 left-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.1),transparent_70%)]" style={{ animationDelay: '3s' }} />

            {/* 3D tilt wrapper */}
            <div
              className="relative h-full w-full transition-transform duration-300 ease-out"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              }}
            >
              {/* Central avatar — Tina */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {/* Spinning gradient ring */}
                <div className="animate-spin-slow absolute -inset-4 rounded-full bg-[conic-gradient(from_0deg,#3b82f6,#8b5cf6,#06b6d4,#3b82f6)] opacity-40 blur-sm" />
                <div className="absolute -inset-3 rounded-full bg-bg-base" />

                <div className="glow-ring relative h-36 w-36 overflow-hidden rounded-full border-2 border-white/10 sm:h-44 sm:w-44">
                  <Image
                    src={central.src}
                    alt={central.name}
                    fill
                    className="object-cover"
                    sizes="176px"
                    priority
                  />
                </div>

                {/* Name label */}
                <div className="mt-3 text-center">
                  <p className="text-sm font-semibold text-text-primary">{central.name}</p>
                  <p className="text-xs text-text-muted">{central.role}</p>
                </div>

                {/* Waveform bars */}
                <div className="absolute -right-10 top-1/2 flex -translate-y-1/2 items-end gap-1">
                  {[0, 0.15, 0.3, 0.15, 0.4].map((delay, i) => (
                    <span
                      key={i}
                      className="animate-waveform w-1 rounded-full bg-accent"
                      style={{
                        height: `${16 + i * 4}px`,
                        animationDelay: `${delay}s`,
                        transformOrigin: 'bottom',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Orbiting avatars */}
              {orbiting.map((avatar, i) => {
                // Position at ~120deg intervals around center
                const positions = [
                  { top: '5%', left: '10%', delay: '0s' },
                  { top: '8%', right: '5%', delay: '1s' },
                  { bottom: '12%', left: '5%', delay: '2.5s' },
                ];
                const pos = positions[i];
                const animClass = i % 2 === 0 ? 'animate-float' : 'animate-float-delayed';

                return (
                  <div
                    key={avatar.name}
                    className={`glass absolute rounded-2xl p-2.5 ${animClass}`}
                    style={{ ...pos, animationDelay: pos.delay }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="glow-ring relative h-14 w-14 overflow-hidden rounded-full border border-white/10 sm:h-16 sm:w-16">
                        <Image
                          src={avatar.src}
                          alt={avatar.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs font-semibold text-text-primary">{avatar.name}</p>
                        <p className="text-[10px] text-text-muted">{avatar.role}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
