'use client';

import { Mic, Globe, Video, Code2, BarChart3, Users } from 'lucide-react';
import { useIntersectionObserver } from './useIntersectionObserver';

const features = [
  {
    icon: Globe,
    title: 'Website-Trained AI',
    desc: 'Your agent learns from your actual website content. No manual training needed.',
  },
  {
    icon: Video,
    title: 'Talking Avatar',
    desc: 'A real face that lip-syncs to responses. Not a chatbot \u2014 a digital human.',
  },
  {
    icon: Code2,
    title: 'Embed Anywhere',
    desc: 'One line of code. Works on any website, Shopify, WordPress, or custom.',
  },
  {
    icon: Mic,
    title: 'Instant Setup',
    desc: 'Paste URL \u2192 get agent. No coding, no training data, no prompt engineering.',
  },
  {
    icon: Users,
    title: 'Lead Capture',
    desc: 'Collect visitor emails and phone numbers during natural conversations.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    desc: 'See what visitors ask, where they drop off, and what converts.',
  },
];

export function FeaturesGrid() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="features" className="px-6 py-24">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-text-primary sm:text-4xl">
            Everything You Need. Nothing You Don&apos;t.
          </h2>
          <p className="text-text-secondary">Built for businesses that want real results, not buzzwords.</p>
        </div>

        <div className="perspective-container grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className={`glass card-3d group rounded-xl p-6 transition-shadow hover:shadow-lg ${
                  isVisible ? 'animate-tilt-in' : 'opacity-0'
                }`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-purple/20 glow-accent">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-text-primary">{feat.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
