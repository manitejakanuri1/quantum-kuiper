/**
 * Health Check Endpoint
 * Monitors application and dependency health (Firebase/Firestore)
 */

import { NextResponse } from 'next/server';
import { firestoreHelpers } from '@/lib/firestore';

// Force dynamic rendering - don't evaluate at build time
export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database: CheckResult;
    memory: CheckResult;
    environment: CheckResult;
  };
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  responseTime?: number;
}

// Track application start time
const startTime = Date.now();

async function checkDatabase(): Promise<CheckResult> {
  const startCheck = Date.now();

  try {
    // Check Firestore connection by querying users collection
    const users = await firestoreHelpers.getCollection('users', []);
    const responseTime = Date.now() - startCheck;

    if (responseTime > 1000) {
      return {
        status: 'warning',
        message: `Database responding slowly (${responseTime}ms)`,
        responseTime,
      };
    }

    return {
      status: 'ok',
      message: 'Firestore connected',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startCheck,
    };
  }
}

function checkMemory(): CheckResult {
  if (typeof process === 'undefined' || !process.memoryUsage) {
    return {
      status: 'warning',
      message: 'Memory stats unavailable',
    };
  }

  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const heapUsedPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  if (heapUsedPercent > 90) {
    return {
      status: 'error',
      message: `Critical memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsedPercent}%)`,
    };
  }

  if (heapUsedPercent > 70) {
    return {
      status: 'warning',
      message: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsedPercent}%)`,
    };
  }

  return {
    status: 'ok',
    message: `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsedPercent}%)`,
  };
}

function checkEnvironment(): CheckResult {
  const requiredVars = [
    'AUTH_SECRET',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    return {
      status: 'error',
      message: `Missing required environment variables: ${missing.join(', ')}`,
    };
  }

  return {
    status: 'ok',
    message: 'All required environment variables are set',
  };
}

export async function GET() {
  try {
    const [databaseCheck, memoryCheck, envCheck] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkMemory()),
      Promise.resolve(checkEnvironment()),
    ]);

    const checks = {
      database: databaseCheck,
      memory: memoryCheck,
      environment: envCheck,
    };

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (Object.values(checks).some((check) => check.status === 'error')) {
      status = 'unhealthy';
    } else if (Object.values(checks).some((check) => check.status === 'warning')) {
      status = 'degraded';
    }

    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || '0.1.0',
      checks,
    };

    const statusCode = status === 'unhealthy' ? 503 : 200;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        environment: process.env.NODE_ENV || 'unknown',
        version: process.env.npm_package_version || '0.1.0',
        checks: {
          error: {
            status: 'error',
            message: error instanceof Error ? error.message : 'Health check failed',
          },
        },
      },
      { status: 503 }
    );
  }
}
