import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LiveDemo } from '@/components/landing/LiveDemo';
import { VideoFallback } from '@/components/landing/VideoFallback';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />
      <Hero />
      <HowItWorks />
      <VideoFallback />
      <LiveDemo />
      <FeaturesGrid />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
