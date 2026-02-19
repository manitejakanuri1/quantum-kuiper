// URL validation utilities — SSRF prevention
// Blocks private/internal IP ranges, localhost, and metadata endpoints

/**
 * Check if a URL points to a public address.
 * Returns true if SAFE (public), false if targeting private/internal host.
 */
export function isPublicUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  // Only allow http and https schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    return false;
  }

  // Block .local, .internal, .localhost TLDs
  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return false;
  }

  // Block private IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10) return false;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return false;   // 172.16.0.0/12
    if (a === 192 && b === 168) return false;             // 192.168.0.0/16
    if (a === 169 && b === 254) return false;             // 169.254.0.0/16 (link-local + AWS metadata)
    if (a === 127) return false;                          // 127.0.0.0/8
    if (a === 0) return false;                            // 0.0.0.0/8
  }

  // Block IPv6 private ranges (bracketed in URLs)
  if (hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1).toLowerCase();
    if (ipv6 === '::1') return false;
    if (ipv6.startsWith('fe80:')) return false;
    if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) return false;
  }

  return true;
}
