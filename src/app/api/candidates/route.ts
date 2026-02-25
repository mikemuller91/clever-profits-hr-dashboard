import { NextResponse } from 'next/server';
import { Candidate, JobOpening } from '@/types/candidates';
import { Redis } from '@upstash/redis';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const CANDIDATES_CACHE_KEY = 'candidates-list-v2';
const LAST_SYNC_KEY = 'candidates-last-sync';

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

type Application = {
  id?: string | number;
  applicant?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    source?: string;
  };
  job?: {
    id?: number;
    title?: { id?: number | null; label?: string };
  };
  status?: { id?: number | null; label?: string };
  appliedDate?: string;
};

function applicationToCandidate(app: Application): Candidate {
  return {
    id: String(app.id || ''),
    firstName: app.applicant?.firstName || '',
    lastName: app.applicant?.lastName || '',
    displayName: `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.trim(),
    email: app.applicant?.email || '',
    phoneNumber: app.applicant?.phoneNumber || '',
    jobId: app.job?.id || null,
    jobTitle: app.job?.title?.label || '',
    status: app.status?.label || 'Unknown',
    statusId: app.status?.id ?? null,
    appliedDate: app.appliedDate || '',
    source: app.applicant?.source || '',
    answers: [],
    rating: null,
    ratingConfidence: null,
    institution: null,
  };
}

function buildJobOpenings(candidates: Candidate[]): JobOpening[] {
  const jobMap = new Map<number, { title: string; count: number }>();
  candidates.forEach(c => {
    if (c.jobId) {
      const existing = jobMap.get(c.jobId);
      if (existing) {
        existing.count++;
      } else {
        jobMap.set(c.jobId, { title: c.jobTitle, count: 1 });
      }
    }
  });

  return Array.from(jobMap.entries())
    .map(([id, { title, count }]) => ({ id, title, candidateCount: count }))
    .sort((a, b) => b.candidateCount - a.candidateCount);
}

export async function GET(request: Request) {
  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === 'true';

  // Always try cache first (unless force refresh)
  if (!forceRefresh && process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const cached = await redis.get<Candidate[]>(CANDIDATES_CACHE_KEY);
      const lastSync = await redis.get<string>(LAST_SYNC_KEY);

      if (cached && cached.length > 0) {
        console.log(`[Candidates API] Returning ${cached.length} cached candidates`);
        const jobOpenings = buildJobOpenings(cached);
        return NextResponse.json({
          candidates: cached,
          jobOpenings,
          totalFetched: cached.length,
          fromCache: true,
          lastSync: lastSync || null,
        });
      }
    } catch (err) {
      console.error('[Candidates API] Cache read error:', err);
    }
  }

  // No cache or force refresh - do full fetch
  try {
    const startTime = Date.now();
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

    // Get existing candidate IDs from cache for incremental sync
    let existingIds = new Set<string>();
    if (!forceRefresh && process.env.UPSTASH_REDIS_REST_URL) {
      try {
        const existing = await redis.get<Candidate[]>(CANDIDATES_CACHE_KEY);
        if (existing) {
          existingIds = new Set(existing.map(c => c.id));
        }
      } catch (err) {
        console.error('[Candidates API] Error reading existing cache:', err);
      }
    }

    // Fetch from BambooHR
    let allApplications: Application[] = [];
    let page = 1;
    let hasMore = true;
    let foundExisting = false;

    while (hasMore && !foundExisting) {
      const fetchUrl = `${baseUrl}/applicant_tracking/applications?page=${page}`;
      console.log('Fetching:', fetchUrl);

      const response = await fetch(fetchUrl, {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ATS API error:', response.status, errorText);
        return NextResponse.json(
          { error: `ATS API error: ${response.status} - ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const applications: Application[] = Array.isArray(data) ? data : (data.applications || data.data || []);

      console.log(`Page ${page}: fetched ${applications.length} applications`);

      if (applications.length === 0) {
        hasMore = false;
      } else {
        // Check if we've hit candidates we already have (for incremental sync)
        if (existingIds.size > 0) {
          const newApps = applications.filter(app => !existingIds.has(String(app.id)));
          if (newApps.length === 0) {
            // All candidates on this page are already cached - stop fetching
            console.log(`[Candidates API] Found all existing candidates at page ${page}, stopping`);
            foundExisting = true;
          } else if (newApps.length < applications.length) {
            // Some new, some existing - add new ones and stop
            allApplications = [...allApplications, ...newApps];
            foundExisting = true;
          } else {
            // All new - continue fetching
            allApplications = [...allApplications, ...applications];
          }
        } else {
          // No existing cache, fetch everything
          allApplications = [...allApplications, ...applications];
        }

        page++;
        if (page > 100) hasMore = false;
      }
    }

    console.log(`Total new applications fetched: ${allApplications.length}`);

    // Convert to candidates
    const newCandidates = allApplications.map(applicationToCandidate);

    // Merge with existing cached candidates
    let allCandidates: Candidate[] = newCandidates;
    if (existingIds.size > 0 && !forceRefresh) {
      try {
        const existing = await redis.get<Candidate[]>(CANDIDATES_CACHE_KEY);
        if (existing) {
          // Merge: new candidates + existing (avoid duplicates)
          const newIds = new Set(newCandidates.map(c => c.id));
          const existingNotDuplicated = existing.filter(c => !newIds.has(c.id));
          allCandidates = [...newCandidates, ...existingNotDuplicated];
        }
      } catch (err) {
        console.error('[Candidates API] Error merging with existing:', err);
      }
    }

    // Sort by applied date (newest first)
    allCandidates.sort((a, b) => {
      if (!a.appliedDate) return 1;
      if (!b.appliedDate) return -1;
      return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
    });

    const jobOpenings = buildJobOpenings(allCandidates);

    // Cache permanently (no TTL)
    if (process.env.UPSTASH_REDIS_REST_URL) {
      try {
        await redis.set(CANDIDATES_CACHE_KEY, allCandidates);
        await redis.set(LAST_SYNC_KEY, new Date().toISOString());
        console.log(`[Candidates API] Cached ${allCandidates.length} candidates permanently`);
      } catch (err) {
        console.error('[Candidates API] Cache write error:', err);
      }
    }

    // Get IDs of new candidates for auto AI evaluation
    const newCandidateIds = newCandidates.map(c => c.id);

    console.log(`[Candidates API] Completed in ${Date.now() - startTime}ms (${newCandidates.length} new, ${allCandidates.length} total)`);

    return NextResponse.json({
      candidates: allCandidates,
      jobOpenings,
      totalFetched: allCandidates.length,
      newCandidates: newCandidates.length,
      newCandidateIds,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}
