import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { AIEvaluation } from '@/types/candidates';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const isRedisConfigured = () => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
};

// GET: Fetch all cached AI evaluations (doesn't generate new ones)
export async function GET() {
  if (!isRedisConfigured()) {
    return NextResponse.json({ evaluations: {} });
  }

  try {
    // Get all cached evaluation keys
    const keys = await redis.keys('ai-eval:*');

    if (keys.length === 0) {
      return NextResponse.json({ evaluations: {} });
    }

    // Fetch all cached evaluations
    const evaluations: Record<string, AIEvaluation> = {};

    // Use mget for efficient batch fetching
    const values = await redis.mget<AIEvaluation[]>(...keys);

    keys.forEach((key, index) => {
      const candidateId = key.replace('ai-eval:', '');
      if (values[index]) {
        evaluations[candidateId] = values[index];
      }
    });

    return NextResponse.json({
      evaluations,
      count: Object.keys(evaluations).length
    });
  } catch (error) {
    console.error('Error fetching cached evaluations:', error);
    return NextResponse.json({ evaluations: {}, error: 'Failed to fetch cached evaluations' });
  }
}
