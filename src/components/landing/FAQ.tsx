'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How does Talk to Site learn about my business?',
    a: 'We crawl your website and extract all the content \u2014 pages, FAQs, product info, pricing. This becomes your agent\u2019s knowledge base. No manual input needed.',
  },
  {
    q: 'Do I need any technical skills?',
    a: 'None. Paste your URL, pick a voice, and your agent is live. One line of code to embed it on your site.',
  },
  {
    q: 'What does the avatar look like?',
    a: 'A photorealistic talking face that lip-syncs in real-time. It\u2019s not a cartoon \u2014 it looks like a real person speaking to your visitors.',
  },
  {
    q: 'Can I use my own face or voice?',
    a: 'Yes! On Growth and Scale plans, you can upload a photo and voice sample to create a custom avatar that represents your brand.',
  },
  {
    q: 'How is this different from a chatbot?',
    a: 'Chatbots are text boxes. Talk to Site is a voice conversation with a real face. Visitors speak naturally and get instant, human-like responses.',
  },
  {
    q: 'What websites work with this?',
    a: 'Any website. E-commerce, restaurants, law firms, SaaS, healthcare \u2014 if it has content, we can train an agent on it.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-text-primary sm:text-4xl">
            Questions? We&apos;ve Got Answers.
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="rounded-xl border border-border-default bg-bg-surface transition-colors hover:border-border-hover"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="pr-4 text-sm font-medium text-text-primary">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-border-default px-6 pb-5 pt-4">
                    <p className="text-sm leading-relaxed text-text-secondary">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
