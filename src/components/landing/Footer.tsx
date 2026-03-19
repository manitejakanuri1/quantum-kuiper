import Link from 'next/link';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Demo', href: '#demo' },
      { label: 'Docs', href: '/docs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'Twitter', href: 'https://twitter.com/talktosite' },
      { label: 'Discord', href: 'https://discord.gg/talktosite' },
      { label: 'Email', href: 'mailto:hello@talktosite.com' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border-default px-6 pb-8 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold text-text-primary">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('http') || link.href.startsWith('mailto') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-text-muted transition-colors hover:text-text-secondary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-text-muted transition-colors hover:text-text-secondary"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border-default pt-8 sm:flex-row">
          <p className="text-xs text-text-muted">&copy; 2026 Talk to Site. All rights reserved.</p>
          <p className="text-xs text-text-muted">Built in India</p>
        </div>
      </div>
    </footer>
  );
}
