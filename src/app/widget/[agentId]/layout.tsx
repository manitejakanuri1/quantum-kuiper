// Widget layout — minimal, no dashboard chrome
// This page is loaded inside an iframe on customer websites

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Talk to Site Widget',
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="m-0 p-0 overflow-hidden bg-[#0D0D0D] min-h-screen">
      {children}
    </div>
  );
}
