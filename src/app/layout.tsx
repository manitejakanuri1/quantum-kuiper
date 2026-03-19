import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["400", "500", "600", "700", "800"],
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Talk to Site - AI Voice Agents for Your Website",
  description: "Create human-like voice agents trained on your website content. Paste a URL, get a working agent in under 2 minutes.",
  keywords: ["AI voice agent", "website chatbot", "voice assistant", "customer service automation"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://talktosite.com'),
  icons: {
    icon: '/logo-icon.svg',
    apple: '/logo-icon.svg',
  },
  openGraph: {
    title: "Talk to Site - AI Voice Agents for Your Website",
    description: "Create human-like voice agents trained on your website content.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk to Site - AI Voice Agents for Your Website",
    description: "Create human-like voice agents trained on your website content.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${jakarta.variable} font-sans antialiased`} suppressHydrationWarning>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
