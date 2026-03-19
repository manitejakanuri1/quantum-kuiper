'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useIntersectionObserver } from './useIntersectionObserver';

const tiers = [
  {
    name: 'Starter',
    monthlyPrice: 0,
    yearlyPrice: 0,
    desc: 'Try it out on your website for free.',
    features: [
      '50 conversations/mo',
      '1 agent',
      'Community support',
      'Talk to Site branding',
      'Default voices & avatars',
    ],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Growth',
    monthlyPrice: 39,
    yearlyPrice: 31,
    desc: 'For growing businesses that need more.',
    features: [
      '500 conversations/mo',
      '3 agents',
      'Talking avatar',
      'Custom branding',
      'Email support',
      'Lead capture',
    ],
    cta: 'Start Growth Plan',
    highlight: true,
  },
  {
    name: 'Scale',
    monthlyPrice: 99,
    yearlyPrice: 79,
    desc: 'For teams that need full control.',
    features: [
      '2,000 conversations/mo',
      '10 agents',
      'Custom voice & face',
      'API access',
      'Priority support',
      'Analytics dashboard',
    ],
    cta: 'Start Scale Plan',
    highlight: false,
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="pricing" className="px-6 py-24">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-text-primary sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mb-8 text-text-secondary">No hidden fees. Cancel anytime.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 rounded-full border border-border-default bg-bg-surface p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !yearly ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                yearly ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Yearly <span className="text-xs text-success">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier, i) => {
            const price = yearly ? tier.yearlyPrice : tier.monthlyPrice;
            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-8 transition-all ${
                  tier.highlight
                    ? 'border-accent bg-bg-surface shadow-lg shadow-accent/5'
                    : 'border-border-default bg-bg-surface hover:border-border-hover'
                } ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}

                <h3 className="mb-1 text-lg font-semibold text-text-primary">{tier.name}</h3>
                <p className="mb-5 text-sm text-text-secondary">{tier.desc}</p>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-text-primary">${price}</span>
                  <span className="text-text-muted">/mo</span>
                </div>

                <Link
                  href="/auth/signup"
                  className={`mb-8 block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                    tier.highlight
                      ? 'bg-accent text-white hover:bg-accent-hover'
                      : 'border border-border-default bg-bg-elevated text-text-primary hover:border-border-hover'
                  }`}
                >
                  {tier.cta}
                </Link>

                <ul className="space-y-3">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-text-secondary">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-text-muted">
          Need more? <a href="mailto:hello@talktosite.com" className="text-accent hover:underline">Contact us</a> for Enterprise pricing.
        </p>
      </div>
    </section>
  );
}
