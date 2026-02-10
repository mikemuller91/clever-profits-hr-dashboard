import { NextResponse } from 'next/server';
import { Candidate, JobOpening } from '@/types/candidates';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

export async function GET() {
  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  try {
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

    // Fetch all applications from ATS with pagination
    // BambooHR uses page parameter (per_page may have a max limit of ~50)
    let allApplications: unknown[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${baseUrl}/applicant_tracking/applications?page=${page}`;
      console.log('Fetching:', url);

      const response = await fetch(url, {
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
      const applications = Array.isArray(data) ? data : (data.applications || data.data || []);

      console.log(`Page ${page}: fetched ${applications.length} applications`);

      // Stop if we got 0 results (no more pages)
      if (applications.length === 0) {
        hasMore = false;
      } else {
        allApplications = [...allApplications, ...applications];
        page++;
        // Safety limit to prevent infinite loops
        if (page > 100) hasMore = false;
      }
    }

    console.log('Total applications fetched:', allApplications.length);

    // Define the application type based on BambooHR ATS API response
    type Application = {
      id?: string | number;
      applicant?: {
        id?: number;
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
        source?: string;
        avatar?: string;
        linkedinUrl?: string;
        websiteUrl?: string;
        address?: {
          addressLine1?: string;
          city?: string;
          state?: string;
          zipcode?: string;
          country?: string;
        };
      };
      job?: {
        id?: number;
        title?: { id?: number | null; label?: string };
      };
      status?: { id?: number | null; label?: string };
      appliedDate?: string;
      rating?: number | null;
    };

    // Transform the response
    const candidates: Candidate[] = (allApplications as Application[]).map((app) => ({
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
      answers: [], // Questions require individual API calls - will implement on-demand
    }));

    // Extract unique job openings with candidate counts
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

    const jobOpenings: JobOpening[] = Array.from(jobMap.entries())
      .map(([id, { title, count }]) => ({ id, title, candidateCount: count }))
      .sort((a, b) => b.candidateCount - a.candidateCount);

    return NextResponse.json({
      candidates,
      jobOpenings,
      totalFetched: allApplications.length,
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}
