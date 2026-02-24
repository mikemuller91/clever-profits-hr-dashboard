import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Check if environment variables are set
  if (!url || !token) {
    return NextResponse.json({
      status: 'NOT_CONFIGURED',
      message: 'Upstash Redis environment variables are missing',
      details: {
        UPSTASH_REDIS_REST_URL: url ? 'SET' : 'MISSING',
        UPSTASH_REDIS_REST_TOKEN: token ? 'SET' : 'MISSING',
      },
    }, { status: 500 });
  }

  // Try to connect and ping Redis
  try {
    const redis = new Redis({ url, token });

    // Test write
    const testKey = 'cache-status-test';
    const testValue = `test-${Date.now()}`;
    await redis.set(testKey, testValue);

    // Test read
    const readValue = await redis.get(testKey);

    // Clean up
    await redis.del(testKey);

    // Count cached evaluations
    const keys = await redis.keys('ai-eval:*');

    return NextResponse.json({
      status: 'CONNECTED',
      message: 'Upstash Redis is working correctly',
      details: {
        writeTest: 'PASSED',
        readTest: readValue === testValue ? 'PASSED' : 'FAILED',
        cachedEvaluations: keys.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'ERROR',
      message: 'Failed to connect to Upstash Redis',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
