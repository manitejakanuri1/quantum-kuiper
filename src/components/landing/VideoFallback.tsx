'use client';

import Image from 'next/image';
import { useIntersectionObserver } from './useIntersectionObserver';

const AGENTS = [
  {
    src: '/faces/tina.png',
    name: 'Tina',
    role: 'Sales Agent',
    tagline: 'Closes deals while you sleep',
  },
  {
    src: '/faces/sabour.png',
    name: 'Sabour',
    role: 'Customer Support',
    tagline: '24/7 customer happiness',
  },
  {
    src: '/faces/doctor.png',
    name: 'Doctor',
    role: 'Knowledge Expert',
    tagline: 'Answers any question instantly',
  },
  {
    src: '/faces/mark.png',
    name: 'Mark',
    role: 'Negotiator',
    tagline: 'Handles objections with ease',
  },
];

export function VideoFallback() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section className="relative px-6 py-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[800px] rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.06),transparent_70%)]" />
      </div>

      <div ref={ref} className="relative mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-text-primary sm:text-4xl">
            Meet Your AI Agents
          </h2>
          <p className="text-text-secondary">
            Real faces. Real conversations. Real results.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((agent, i) => (
            <div
              key={agent.name}
              className={`glass card-3d rounded-2xl p-6 text-center ${
                isVisible ? 'animate-tilt-in' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {/* Avatar */}
              <div className="mx-auto mb-4">
                <div className="glow-ring relative mx-auto h-28 w-28 overflow-hidden rounded-full border-2 border-white/10 sm:h-32 sm:w-32">
                  <Image
                    src={agent.src}
                    alt={agent.name}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              </div>

              {/* Waveform bars */}
              <div className="mb-4 flex items-end justify-center gap-1">
                {[0, 0.2, 0.4, 0.2, 0.1].map((delay, j) => (
                  <span
                    key={j}
                    className="animate-waveform w-1 rounded-full bg-accent/60"
                    style={{
                      height: `${12 + j * 3}px`,
                      animationDelay: `${delay + i * 0.15}s`,
                      transformOrigin: 'bottom',
                    }}
                  />
                ))}
              </div>

              {/* Info */}
              <h3 className="text-base font-semibold text-text-primary">{agent.name}</h3>
              <p className="mb-2 text-xs font-medium text-accent">{agent.role}</p>
              <p className="text-sm leading-relaxed text-text-secondary">{agent.tagline}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
