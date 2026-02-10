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

    // Fetch applications from ATS
    const response = await fetch(`${baseUrl}/applicant_tracking/applications`, {
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

    // BambooHR might return data directly as array or under different keys
    const applications = Array.isArray(data) ? data : (data.applications || data.data || []);

    // Debug: log first application structure
    if (applications.length > 0) {
      console.log('First application keys:', Object.keys(applications[0]));
      console.log('First application:', JSON.stringify(applications[0], null, 2));
    }

    // Transform the response
    const candidates: Candidate[] = applications.map((app: {
      id?: string | number;
      applicant?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
      };
      job?: {
        title?: string;
      };
      jobTitle?: string | { id?: string | null; label?: string };
      status?: string | { id?: string | null; label?: string };
      appliedDate?: string;
      source?: string;
    }) => ({
      id: String(app.id || ''),
      firstName: app.applicant?.firstName || '',
      lastName: app.applicant?.lastName || '',
      displayName: `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.trim(),
      email: app.applicant?.email || '',
      phoneNumber: app.applicant?.phoneNumber || '',
      jobTitle: app.jobTitle
        ? ((app.jobTitle as Record<string, unknown>)['label'] as string || app.job?.title || 'Unknown')
        : 'None',
      status: app.status
        ? ((app.status as Record<string, unknown>)['label'] as string || 'Unknown')
        : 'None',
      appliedDate: app.appliedDate || '',
      source: app.source || '',
    }));

    // Return debug info along with candidates
    return NextResponse.json({
      candidates,
      debug: {
        firstAppKeys: applications[0] ? Object.keys(applications[0]) : [],
        sampleJobTitle: applications[0]?.jobTitle,
        sampleJob: applications[0]?.job,
      }
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}
