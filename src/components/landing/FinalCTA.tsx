import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="glass relative overflow-hidden rounded-2xl p-12 text-center sm:p-16">
          {/* Layered gradient glows */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_40%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(139,92,246,0.08),transparent_70%)]" />

          {/* Floating decorative avatars */}
          <div className="animate-float pointer-events-none absolute left-8 top-8 h-12 w-12 overflow-hidden rounded-full opacity-20 sm:left-12 sm:top-12">
            <Image src="/faces/sabour.png" alt="" fill className="object-cover" sizes="48px" />
          </div>
          <div className="animate-float-delayed pointer-events-none absolute bottom-8 right-8 h-12 w-12 overflow-hidden rounded-full opacity-20 sm:bottom-12 sm:right-12">
            <Image src="/faces/mark.png" alt="" fill className="object-cover" sizes="48px" />
          </div>

          <div className="relative">
            <h2 className="mb-4 text-3xl font-bold text-text-primary sm:text-4xl">
              Your Website Never Sleeps.
              <br />
              Neither Should Your Support.
            </h2>
            <p className="mb-8 text-lg text-text-secondary">
              Create your first AI voice agent in under 5 minutes. Free to start.
            </p>
            <Link
              href="/auth/signup"
              className="glow-accent inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 text-base font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_50px_rgba(59,130,246,0.3)]"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
