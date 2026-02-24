import { Redis } from '@upstash/redis';
import { AIEvaluation } from '@/types/candidates';

// Initialize Redis client (will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Cache key format: ai-eval:{candidateId}
const getCacheKey = (candidateId: string) => `ai-eval:${candidateId}`;

// Check if Redis is configured
const isRedisConfigured = () => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
};

export async function getCachedEvaluation(candidateId: string): Promise<AIEvaluation | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const cached = await redis.get<AIEvaluation>(getCacheKey(candidateId));
    return cached;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

export async function setCachedEvaluation(candidateId: string, evaluation: AIEvaluation): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    // Store indefinitely (no TTL) since evaluations don't change
    await redis.set(getCacheKey(candidateId), evaluation);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export async function deleteCachedEvaluation(candidateId: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    await redis.del(getCacheKey(candidateId));
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}
