// Environment Variable Validation
// Validates all required environment variables at application startup
// Updated: Removed Supabase, now Firebase-only

interface EnvConfig {
    // Firebase
    FIREBASE_PROJECT_ID: string;
    FIREBASE_CLIENT_EMAIL?: string;
    FIREBASE_PRIVATE_KEY?: string;
    NEXT_PUBLIC_FIREBASE_API_KEY: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;

    // NextAuth
    AUTH_SECRET: string;

    // FishAudio
    FISH_AUDIO_API_KEY: string;

    // Deepgram
    NEXT_PUBLIC_DEEPGRAM_API_KEY: string;

    // Simli
    NEXT_PUBLIC_SIMLI_API_KEY: string;

    // Optional
    FIRECRAWL_API_KEY?: string;
    API_SECRET_KEY?: string;
    NEXT_PUBLIC_BACKEND_URL?: string;
    NEXT_PUBLIC_WEBSOCKET_URL?: string;
}

/**
 * Validate required environment variables
 * Throws error if any required variable is missing
 */
export function validateEnvironment(): EnvConfig {
    const errors: string[] = [];

    // Required variables (Firebase-only, no Supabase)
    const required = {
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        AUTH_SECRET: process.env.AUTH_SECRET,
        FISH_AUDIO_API_KEY: process.env.FISH_AUDIO_API_KEY,
        NEXT_PUBLIC_DEEPGRAM_API_KEY: process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY,
        NEXT_PUBLIC_SIMLI_API_KEY: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
    };

    // Check for missing required variables (warn instead of error for optional ones)
    const criticalVars = ['FIREBASE_PROJECT_ID', 'AUTH_SECRET'];
    for (const key of criticalVars) {
        if (!required[key as keyof typeof required]) {
            errors.push(`Missing required environment variable: ${key}`);
        }
    }

    // Warn about missing but non-critical vars
    const nonCriticalVars = ['FISH_AUDIO_API_KEY', 'NEXT_PUBLIC_DEEPGRAM_API_KEY', 'NEXT_PUBLIC_SIMLI_API_KEY'];
    for (const key of nonCriticalVars) {
        if (!required[key as keyof typeof required]) {
            console.warn(`⚠️ ${key} not set - some features may not work`);
        }
    }

    // Validate AUTH_SECRET strength
    if (required.AUTH_SECRET && required.AUTH_SECRET.length < 32) {
        errors.push('AUTH_SECRET must be at least 32 characters for security');
    }

    // Validate Firebase config for server-side
    if (typeof window === 'undefined') {
        if (!process.env.FIREBASE_CLIENT_EMAIL) {
            console.warn('⚠️ FIREBASE_CLIENT_EMAIL not set - server-side admin operations will fail');
        }
        if (!process.env.FIREBASE_PRIVATE_KEY) {
            console.warn('⚠️ FIREBASE_PRIVATE_KEY not set - server-side admin operations will fail');
        }
    }

    if (errors.length > 0) {
        throw new Error(
            `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
        );
    }

    return {
        FIREBASE_PROJECT_ID: required.FIREBASE_PROJECT_ID!,
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
        NEXT_PUBLIC_FIREBASE_API_KEY: required.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: required.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        AUTH_SECRET: required.AUTH_SECRET!,
        FISH_AUDIO_API_KEY: required.FISH_AUDIO_API_KEY || '',
        NEXT_PUBLIC_DEEPGRAM_API_KEY: required.NEXT_PUBLIC_DEEPGRAM_API_KEY || '',
        NEXT_PUBLIC_SIMLI_API_KEY: required.NEXT_PUBLIC_SIMLI_API_KEY || '',
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
        API_SECRET_KEY: process.env.API_SECRET_KEY,
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
        NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
    };
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

/**
 * Get safe environment info for logging (without exposing secrets)
 */
export function getEnvironmentInfo(): Record<string, string> {
    return {
        NODE_ENV: process.env.NODE_ENV || 'development',
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not-set',
        HAS_AUTH_SECRET: !!process.env.AUTH_SECRET ? 'yes' : 'no',
        HAS_FIREBASE_ADMIN: !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ? 'yes' : 'no',
        HAS_FISH_AUDIO_KEY: !!process.env.FISH_AUDIO_API_KEY ? 'yes' : 'no',
        HAS_DEEPGRAM_KEY: !!process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY ? 'yes' : 'no',
    };
}

// Auto-validate on module load (server-side only)
// Disabled: causes build issues when env vars aren't available
// if (typeof window === 'undefined') {
//     try {
//         validateEnvironment();
//         console.log('✅ Environment validation passed');
//     } catch (error) {
//         console.error('❌ Environment validation failed:', error);
//     }
// }
