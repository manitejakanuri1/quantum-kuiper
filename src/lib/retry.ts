/**
 * Retry utility with exponential backoff
 * Used for retrying failed API calls and connections
 */

export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
};

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * const result = await withRetry(
 *   () => fetch('https://api.example.com'),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this was the last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff: 1s, 2s, 4s, 8s...
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Execute a function with a timeout
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @returns The result of the function
 * @throws TimeoutError if the function takes longer than timeoutMs
 *
 * @example
 * const result = await withTimeout(
 *   () => fetch('https://api.example.com'),
 *   30000,
 *   'API request timed out'
 * );
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Combine retry and timeout for robust API calls
 *
 * @param fn - The async function to execute
 * @param retryConfig - Retry configuration
 * @param timeoutMs - Timeout in milliseconds
 * @returns The result of the function
 *
 * @example
 * const result = await withRetryAndTimeout(
 *   () => fetch('https://api.example.com'),
 *   { maxRetries: 3 },
 *   30000
 * );
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  retryConfig: RetryConfig = {},
  timeoutMs = 30000
): Promise<T> {
  return withRetry(
    () => withTimeout(fn, timeoutMs),
    retryConfig
  );
}
