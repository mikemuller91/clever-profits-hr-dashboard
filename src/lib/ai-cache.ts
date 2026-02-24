import { Redis } from '@upstash/redis';
import { AIEvaluation } from '@/types/candidates';

// Initialize Redis client (will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Cache key format: ai-eval:{candidateId}
const getCacheKey = (candidateId: string) => `ai-eval:${candidateId}`;

// Track if we've already warned about missing config (to avoid log spam)
let hasWarnedMissingConfig = false;

// Check if Redis is configured
const isRedisConfigured = () => {
  const configured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!configured && !hasWarnedMissingConfig) {
    console.warn('[AI Cache] WARNING: Upstash Redis not configured - AI evaluations will NOT be cached!');
    console.warn('[AI Cache] Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    console.warn('[AI Cache] Without caching, each page refresh will re-run costly AI evaluations.');
    hasWarnedMissingConfig = true;
  }
  return configured;
};

export async function getCachedEvaluation(candidateId: string): Promise<AIEvaluation | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const cached = await redis.get<AIEvaluation>(getCacheKey(candidateId));
    if (cached) {
      console.log(`[AI Cache] Cache HIT for candidate ${candidateId}`);
    } else {
      console.log(`[AI Cache] Cache MISS for candidate ${candidateId}`);
    }
    return cached;
  } catch (error) {
    console.error('[AI Cache] Redis get error:', error);
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
    console.log(`[AI Cache] Stored evaluation for candidate ${candidateId}`);
  } catch (error) {
    console.error('[AI Cache] Redis set error:', error);
  }
}

export async function deleteCachedEvaluation(candidateId: string): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    await redis.del(getCacheKey(candidateId));
    console.log(`[AI Cache] Deleted evaluation for candidate ${candidateId}`);
  } catch (error) {
    console.error('[AI Cache] Redis delete error:', error);
  }
}
