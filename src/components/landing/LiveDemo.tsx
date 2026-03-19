'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import Image from 'next/image';
import { Mic, Send, Volume2 } from 'lucide-react';

type DemoState = 'idle' | 'verifying' | 'active' | 'expired' | 'error' | 'rate-limited';

// Simulated conversation for when no demo agent is configured
const DEMO_MESSAGES: { role: 'user' | 'agent'; text: string; delay: number }[] = [
  { role: 'agent', text: "Hi! I'm the AI assistant for Sara's Web Design Studio. How can I help you today?", delay: 800 },
  { role: 'user', text: 'What services do you offer?', delay: 2500 },
  { role: 'agent', text: 'Sara specializes in custom website design, e-commerce solutions, and brand identity packages. Our most popular package starts at $2,500 for a complete 5-page website with mobile optimization.', delay: 4500 },
  { role: 'user', text: 'How long does a typical project take?', delay: 7500 },
  { role: 'agent', text: "Most projects are completed within 2-4 weeks depending on complexity. We start with a discovery call, then move to wireframes, design, and development. You'll get revision rounds at each stage.", delay: 9500 },
  { role: 'user', text: 'Can I see some examples?', delay: 12500 },
  { role: 'agent', text: "Absolutely! You can check out our portfolio at sitesbysara.com/portfolio. Some recent favorites include a boutique hotel site and a fitness studio rebrand. Want me to walk you through any specific project?", delay: 14500 },
];

function StaticDemoWidget() {
  const [visibleMessages, setVisibleMessages] = useState<typeof DEMO_MESSAGES>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    DEMO_MESSAGES.forEach((msg, i) => {
      // Show typing indicator before agent messages
      if (msg.role === 'agent') {
        timers.push(setTimeout(() => setIsTyping(true), msg.delay - 600));
      }
      timers.push(setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages((prev) => [...prev, msg]);
      }, msg.delay));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [visibleMessages, isTyping]);

  return (
    <div className="flex h-[480px] flex-col rounded-xl bg-bg-base">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-default px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
          <Volume2 className="h-4 w-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Sara&apos;s Web Studio</p>
          <p className="text-xs text-success">● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {visibleMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-accent text-white'
                : 'bg-bg-elevated text-text-primary'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-bg-elevated px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border-default px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-bg-elevated px-4 py-2.5">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            disabled
          />
          <button className="rounded-full p-1.5 text-text-muted" disabled><Mic className="h-4 w-4" /></button>
          <button className="rounded-full p-1.5 text-text-muted" disabled><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

export function LiveDemo() {
  const [state, setState] = useState<DemoState>('idle');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(180);
  const [turnstileReady, setTurnstileReady] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Turnstile callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).onTurnstileSuccess = (token: string) => {
        setTurnstileToken(token);
      };
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (state !== 'active') return;
    if (timeLeft <= 0) {
      setState('expired');
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [state, timeLeft]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }

    if (!turnstileToken && siteKey) {
      setError('Verification pending. Please wait a moment and try again.');
      return;
    }

    setState('verifying');

    try {
      const res = await fetch('/api/demo/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setState('rate-limited');
          return;
        }
        setError(data.error || 'Verification failed. Please try again.');
        setState('idle');
        return;
      }

      setState('active');
      setTimeLeft(180);
    } catch {
      setError('Something went wrong. Please try again.');
      setState('idle');
    }
  }, [email, turnstileToken, siteKey]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <section id="demo" className="px-6 py-24">
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
          onLoad={() => setTurnstileReady(true)}
        />
      )}

      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-text-primary sm:text-4xl">
            Don&apos;t Take Our Word For It. Talk to an Agent.
          </h2>
          <p className="text-text-secondary">
            Try a live AI agent trained on a real website.
          </p>
        </div>

        <div className="mx-auto max-w-lg">
          {/* Idle / Verifying state */}
          {(state === 'idle' || state === 'verifying') && (
            <div className="glass rounded-2xl p-8">
              {/* Avatar preview */}
              <div className="mb-6 flex flex-col items-center">
                <div className="relative mb-4">
                  {/* Pulsing glow ring */}
                  <div className="animate-pulse-glow absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.2),transparent_70%)]" />
                  <div className="glow-ring relative h-20 w-20 overflow-hidden rounded-full border-2 border-white/10">
                    <Image src="/faces/tina.png" alt="AI Agent" fill className="object-cover" sizes="80px" />
                  </div>
                </div>
                <p className="text-center text-sm text-text-secondary">
                  Talk to a live AI agent trained on a real website
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-base px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent"
                  disabled={state === 'verifying'}
                />

                {/* Turnstile widget */}
                {siteKey && turnstileReady && (
                  <div
                    className="cf-turnstile"
                    data-sitekey={siteKey}
                    data-callback="onTurnstileSuccess"
                    data-theme="dark"
                  />
                )}

                {error && <p className="text-sm text-error">{error}</p>}

                <button
                  type="submit"
                  disabled={state === 'verifying'}
                  className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {state === 'verifying' ? 'Verifying...' : 'Start Live Demo'}
                </button>

                <p className="text-center text-xs text-text-muted">
                  We&apos;ll send you a copy of the conversation
                </p>
              </form>
            </div>
          )}

          {/* Active demo */}
          {state === 'active' && (
            <div className="glow-accent rounded-2xl border border-accent/20 bg-bg-surface p-2">
              <div className="mb-2 flex items-center justify-between px-4 pt-3">
                <span className="text-xs text-text-muted">Live Demo</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  timeLeft <= 30 ? 'bg-error/20 text-error' : 'bg-accent/20 text-accent'
                }`}>
                  {formatTime(timeLeft)}
                </span>
              </div>

              {timeLeft <= 30 && timeLeft > 0 && (
                <div className="mx-4 mb-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  30 seconds left — sign up for unlimited access
                </div>
              )}

              {process.env.NEXT_PUBLIC_DEMO_AGENT_ID ? (
                <iframe
                  src={`/widget/${process.env.NEXT_PUBLIC_DEMO_AGENT_ID}`}
                  className="h-[480px] w-full rounded-xl border-0"
                  allow="microphone"
                />
              ) : (
                <StaticDemoWidget />
              )}
            </div>
          )}

          {/* Expired */}
          {state === 'expired' && (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="mb-4 text-4xl">&#128075;</div>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Demo ended!</h3>
              <p className="mb-6 text-sm text-text-secondary">
                Create a free account for unlimited conversations.
              </p>
              <a
                href="/auth/signup"
                className="inline-flex rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Sign Up Free
              </a>
            </div>
          )}

          {/* Rate limited */}
          {state === 'rate-limited' && (
            <div className="glass rounded-2xl p-8 text-center">
              <h3 className="mb-2 text-lg font-semibold text-text-primary">
                You&apos;ve already tried the demo today
              </h3>
              <p className="mb-6 text-sm text-text-secondary">
                Sign up free for unlimited access!
              </p>
              <a
                href="/auth/signup"
                className="inline-flex rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Create Free Account
              </a>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-text-muted">
            This agent was trained on sitesbysara.com in under 3 minutes
          </p>
        </div>
      </div>
    </section>
  );
}
