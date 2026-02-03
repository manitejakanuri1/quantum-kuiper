/**
 * Centralized logging utility using Winston
 * Replaces console.log with structured, production-ready logging
 */

import winston from 'winston';

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

// Custom format for file output (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports: winston.transport[] = [
  // Console transport for development
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
    })
  );
}

// Create winston logger instance
const winstonLogger = winston.createLogger({
  level: level(),
  levels,
  transports,
  // Don't exit on unhandled exceptions
  exitOnError: false,
});

/**
 * Sanitize sensitive data from logs
 * Removes passwords, API keys, tokens, etc.
 */
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'session',
  ];

  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Logger with sanitization
 */
export const log = {
  error: (message: string, meta?: any) => {
    winstonLogger.error(message, meta ? sanitizeLogData(meta) : undefined);
  },
  warn: (message: string, meta?: any) => {
    winstonLogger.warn(message, meta ? sanitizeLogData(meta) : undefined);
  },
  info: (message: string, meta?: any) => {
    winstonLogger.info(message, meta ? sanitizeLogData(meta) : undefined);
  },
  http: (message: string, meta?: any) => {
    winstonLogger.http(message, meta ? sanitizeLogData(meta) : undefined);
  },
  debug: (message: string, meta?: any) => {
    winstonLogger.debug(message, meta ? sanitizeLogData(meta) : undefined);
  },
};

/**
 * Log HTTP request
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number
) {
  log.http(`${method} ${path} ${statusCode} - ${duration}ms`);
}

/**
 * Log error with stack trace
 */
export function logError(error: Error, context?: string) {
  log.error(`${context ? `${context}: ` : ''}${error.message}`, {
    stack: error.stack,
    name: error.name,
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(event: string, details?: any) {
  log.warn(`[SECURITY] ${event}`, details ? sanitizeLogData(details) : undefined);
}

// Alias for backwards compatibility
export const logger = log;

export default log;

