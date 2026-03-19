'use client';

import Image from 'next/image';
import { useIntersectionObserver } from './useIntersectionObserver';

const steps = [
  {
    num: '01',
    title: 'Paste Your URL',
    desc: 'Enter your website address. That\u2019s all we need to get started.',
    visual: (
      <div className="rounded-lg border border-white/[0.06] bg-bg-base p-4">
        <div className="flex items-center gap-2 rounded-md border border-border-hover bg-bg-elevated px-3 py-2.5 text-sm text-text-secondary">
          <svg className="h-4 w-4 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          <span>https://your-website.com</span>
          <span className="ml-auto h-4 w-0.5 animate-pulse bg-accent" />
        </div>
      </div>
    ),
  },
  {
    num: '02',
    title: 'We Learn Everything',
    desc: 'Our crawler reads every page and builds a knowledge base automatically.',
    visual: (
      <div className="rounded-lg border border-white/[0.06] bg-bg-base p-4">
        <div className="space-y-2">
          {[85, 60, 40].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${w}%` }} />
              </div>
              <span className="text-xs tabular-nums text-text-muted">{w}%</span>
            </div>
          ))}
          <p className="mt-2 text-xs text-text-muted">47 pages indexed...</p>
        </div>
      </div>
    ),
  },
  {
    num: '03',
    title: 'Your Agent Goes Live',
    desc: 'A voice agent with a real face, ready to answer visitors on your website.',
    visual: (
      <div className="rounded-lg border border-white/[0.06] bg-bg-base p-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10">
            <Image src="/faces/tina.png" alt="Tina" fill className="object-cover" sizes="40px" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-base bg-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Agent Active</p>
            <p className="text-xs text-success">Ready to answer questions</p>
          </div>
        </div>
      </div>
    ),
  },
];

export function HowItWorks() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="how-it-works" className="px-6 py-24">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-text-primary sm:text-4xl">
            Live in 5 Minutes. Seriously.
          </h2>
          <p className="text-text-secondary">Three steps. No coding. No training data.</p>
        </div>

        <div className="perspective-container relative grid gap-8 md:grid-cols-3">
          {/* Connecting line (desktop) */}
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 md:block">
            <div className="mx-16 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
          </div>

          {steps.map((step, i) => (
            <div
              key={step.num}
              className={`glass card-3d relative rounded-xl p-6 ${
                isVisible ? 'animate-tilt-in' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-sm font-bold text-accent">
                {step.num}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">{step.title}</h3>
              <p className="mb-5 text-sm leading-relaxed text-text-secondary">{step.desc}</p>
              {step.visual}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
