/**
 * Centralized validation schemas using Zod
 * Ensures type safety and runtime validation for all API inputs
 */

import { z } from 'zod';

// UUID validation
export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

// URL validation with security constraints
export const urlSchema = z
  .string()
  .url({ message: 'Invalid URL format' })
  .max(2000, { message: 'URL too long' })
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Only allow http and https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return false;
        }
        // Block private IP ranges and localhost
        const hostname = parsed.hostname.toLowerCase();
        const privatePatterns = [
          /^localhost$/i,
          /^127\./,
          /^10\./,
          /^172\.(1[6-9]|2[0-9]|3[01])\./,
          /^192\.168\./,
          /^169\.254\./,
          /^::1$/,
          /^fe80:/i,
          /^fc00:/i,
          /^fd00:/i,
        ];
        return !privatePatterns.some((pattern) => pattern.test(hostname));
      } catch {
        return false;
      }
    },
    { message: 'Cannot use private or internal URLs' }
  );

// Agent creation schema
export const createAgentSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Agent name is required' })
    .max(100, { message: 'Agent name too long' })
    .trim(),
  websiteUrl: urlSchema,
  voiceId: z.string().optional(),
  avatarId: z.string().optional(),
  description: z
    .string()
    .max(500, { message: 'Description too long' })
    .optional(),
});

// Session creation schema
export const createSessionSchema = z.object({
  agent_id: uuidSchema,
});

// Crawl website schema
export const crawlWebsiteSchema = z.object({
  websiteUrl: urlSchema,
  agentId: uuidSchema,
});

// Q&A pair schema
export const qaPairSchema = z.object({
  question: z
    .string()
    .min(1, { message: 'Question is required' })
    .max(500, { message: 'Question too long' })
    .trim(),
  spoken_response: z
    .string()
    .min(1, { message: 'Response is required' })
    .max(1000, { message: 'Response too long' })
    .trim(),
  keywords: z.array(z.string()).max(20).optional(),
  priority: z.number().int().min(1).max(10).default(5),
});

// TTS request schema
export const ttsRequestSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Text is required' })
    .max(5000, { message: 'Text too long for TTS' })
    .trim(),
  voiceId: z.string().min(1, { message: 'Voice ID is required' }),
});

// Search knowledge schema
export const searchKnowledgeSchema = z.object({
  query: z
    .string()
    .min(1, { message: 'Query is required' })
    .max(500, { message: 'Query too long' })
    .trim(),
  agentId: uuidSchema,
});

// Auth credentials schema
export const authCredentialsSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).toLowerCase(),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(100, { message: 'Password too long' }),
});

// Update agent schema (partial)
export const updateAgentSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  websiteUrl: urlSchema.optional(),
  voiceId: z.string().optional(),
  avatarId: z.string().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Session action schema for agent/session endpoint
export const sessionActionSchema = z.object({
  action: z.enum(['start', 'message', 'status'], {
    errorMap: () => ({ message: 'Invalid action. Must be: start, message, or status' }),
  }),
  agentId: uuidSchema,
  sessionId: uuidSchema.optional(),
  userText: z
    .string()
    .min(1, { message: 'User text is required for message action' })
    .max(2000, { message: 'Message too long (max 2000 characters)' })
    .optional(),
});

/**
 * Helper function to validate request body and return typed data
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Validated and typed data
 * @throws Error with validation messages if validation fails
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map((err) => err.message).join(', ');
    throw new Error(`Validation failed: ${errors}`);
  }

  return result.data;
}

/**
 * Sanitize string input to prevent XSS
 * Removes potentially dangerous HTML/script tags
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove inline event handlers
    .trim();
}

/**
 * Validate and sanitize user-provided text
 */
export function sanitizeUserInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  const sanitized = sanitizeString(input);

  if (sanitized.length > maxLength) {
    throw new Error(`Input too long (max ${maxLength} characters)`);
  }

  return sanitized;
}
