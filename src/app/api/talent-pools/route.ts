import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { TalentPool } from '@/types/candidates';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const TALENT_POOLS_KEY = 'talent-pools';

const DEFAULT_POOLS: TalentPool[] = [
  { id: 'junior-accountants', name: 'Junior Accountants', candidateIds: [], createdAt: new Date().toISOString() },
  { id: 'senior-accountants', name: 'Senior Accountants', candidateIds: [], createdAt: new Date().toISOString() },
  { id: 'finance-managers', name: 'Finance Managers', candidateIds: [], createdAt: new Date().toISOString() },
  { id: 'financial-controllers', name: 'Financial Controllers', candidateIds: [], createdAt: new Date().toISOString() },
];

async function getPools(): Promise<TalentPool[]> {
  try {
    const pools = await redis.get<TalentPool[]>(TALENT_POOLS_KEY);
    if (!pools || pools.length === 0) {
      // Seed default pools
      await redis.set(TALENT_POOLS_KEY, DEFAULT_POOLS);
      return DEFAULT_POOLS;
    }
    return pools;
  } catch (err) {
    console.error('[Talent Pools] Error reading pools:', err);
    return DEFAULT_POOLS;
  }
}

async function savePools(pools: TalentPool[]): Promise<void> {
  await redis.set(TALENT_POOLS_KEY, pools);
}

// GET - List all talent pools
export async function GET() {
  try {
    const pools = await getPools();
    return NextResponse.json({ pools });
  } catch (error) {
    console.error('[Talent Pools] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch talent pools' },
      { status: 500 }
    );
  }
}

// POST - Add/remove candidate from pool
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { poolId, candidateId, action } = body;

    if (!poolId || !candidateId || !action) {
      return NextResponse.json(
        { error: 'poolId, candidateId, and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json(
        { error: 'action must be "add" or "remove"' },
        { status: 400 }
      );
    }

    const pools = await getPools();
    const poolIndex = pools.findIndex(p => p.id === poolId);

    if (poolIndex === -1) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    if (action === 'add') {
      if (!pools[poolIndex].candidateIds.includes(candidateId)) {
        pools[poolIndex].candidateIds.push(candidateId);
      }
    } else {
      pools[poolIndex].candidateIds = pools[poolIndex].candidateIds.filter(id => id !== candidateId);
    }

    await savePools(pools);

    return NextResponse.json({ pool: pools[poolIndex] });
  } catch (error) {
    console.error('[Talent Pools] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update talent pool' },
      { status: 500 }
    );
  }
}
