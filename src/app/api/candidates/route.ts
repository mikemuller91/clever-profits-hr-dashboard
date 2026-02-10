import { NextResponse } from 'next/server';

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  jobTitle: string;
  status: string;
  appliedDate: string;
  source: string;
}

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
    let allApplications: unknown[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${baseUrl}/applicant_tracking/applications?page=${page}&pageSize=${pageSize}`,
        {
          headers: {
            'Authorization': getAuthHeader(),
            'Accept': 'application/json',
          },
          cache: 'no-store',
        }
      );

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

      allApplications = [...allApplications, ...applications];

      // Stop if we got fewer results than requested (no more pages)
      if (applications.length < pageSize) {
        hasMore = false;
      } else {
        page++;
        // Safety limit to prevent infinite loops
        if (page > 20) hasMore = false;
      }
    }

    // Define the application type
    type Application = {
      id?: string | number;
      applicant?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
      };
      job?: {
        id?: number;
        title?: { id?: number | null; label?: string };
      };
      status?: string | { id?: string | null; label?: string };
      appliedDate?: string;
      source?: string;
    };

    // Transform the response
    const candidates: Candidate[] = (allApplications as Application[]).map((app) => ({
      id: String(app.id || ''),
      firstName: app.applicant?.firstName || '',
      lastName: app.applicant?.lastName || '',
      displayName: `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.trim(),
      email: app.applicant?.email || '',
      phoneNumber: app.applicant?.phoneNumber || '',
      jobTitle: app.job?.title?.label || '',
      status: app.status
        ? ((app.status as Record<string, unknown>)['label'] as string || 'Unknown')
        : 'None',
      appliedDate: app.appliedDate || '',
      source: app.source || '',
    }));

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}
