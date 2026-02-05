// Security Utilities
// Input sanitization, XSS protection, and validation helpers

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes all HTML tags and dangerous characters
 */
export function sanitizeHtml(input: string): string {
    if (!input) return '';

    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize user input to prevent injection attacks
 * Removes potentially dangerous characters
 */
export function sanitizeInput(input: string): string {
    if (!input) return '';

    // Remove null bytes and control characters
    return input
        .replace(/\0/g, '')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim();
}

/**
 * Validate URL to prevent SSRF and other attacks
 */
export function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        // Only allow HTTP/HTTPS
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
        }

        // Block private/local IPs
        const hostname = parsed.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname.startsWith('127.') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.endsWith('.local') ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)
        ) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '_') // Prevent ../
        .substring(0, 255); // Limit length
}

/**
 * Check if string contains SQL injection patterns
 * Note: This is a basic check. Use parameterized queries for real protection.
 */
export function containsSqlInjection(input: string): boolean {
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
        /(--|#|\/\*|\*\/)/g,
        /(\bOR\b.*=.*)/gi,
        /(\bAND\b.*=.*)/gi,
        /('|"|;|\\)/g,
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check if string contains NoSQL injection patterns
 */
export function containsNoSqlInjection(input: string): boolean {
    const noSqlPatterns = [
        /(\$where|\$ne|\$gt|\$lt|\$regex)/gi,
        /({\s*\$)/g,
    ];

    return noSqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Validate and sanitize agent name
 */
export function validateAgentName(name: string): { valid: boolean; sanitized: string; error?: string } {
    if (!name || typeof name !== 'string') {
        return { valid: false, sanitized: '', error: 'Name is required' };
    }

    const sanitized = sanitizeInput(name);

    if (sanitized.length < 2) {
        return { valid: false, sanitized, error: 'Name must be at least 2 characters' };
    }

    if (sanitized.length > 100) {
        return { valid: false, sanitized, error: 'Name must be less than 100 characters' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate and sanitize website URL
 */
export function validateWebsiteUrl(url: string): { valid: boolean; sanitized: string; error?: string } {
    if (!url || typeof url !== 'string') {
        return { valid: false, sanitized: '', error: 'URL is required' };
    }

    const sanitized = sanitizeInput(url);

    if (!isValidUrl(sanitized)) {
        return { valid: false, sanitized, error: 'Invalid URL format or unsafe URL' };
    }

    if (sanitized.length > 2048) {
        return { valid: false, sanitized, error: 'URL too long' };
    }

    return { valid: true, sanitized };
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const randomValues = new Uint8Array(length);

    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(randomValues);
    } else if (typeof global !== 'undefined' && global.crypto) {
        global.crypto.getRandomValues(randomValues);
    } else {
        // Fallback (less secure)
        for (let i = 0; i < length; i++) {
            randomValues[i] = Math.floor(Math.random() * 256);
        }
    }

    for (let i = 0; i < length; i++) {
        token += charset[randomValues[i] % charset.length];
    }

    return token;
}

/**
 * Validate content length
 */
export function validateContentLength(
    content: string,
    maxLength: number = 10000
): { valid: boolean; error?: string } {
    if (!content || typeof content !== 'string') {
        return { valid: false, error: 'Content is required' };
    }

    if (content.length > maxLength) {
        return { valid: false, error: `Content exceeds maximum length of ${maxLength} characters` };
    }

    return { valid: true };
}

/**
 * Security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
}
