import { NextResponse } from 'next/server';
import { CandidateStatus } from '@/types/candidates';

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
    const url = `${baseUrl}/applicant_tracking/statuses`;

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ATS Statuses API error:', response.status, errorText);
      return NextResponse.json(
        { error: `ATS API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // BambooHR returns an array of status objects with id and name
    // Note: BambooHR may return id as string or number
    const statuses: CandidateStatus[] = (Array.isArray(data) ? data : data.statuses || []).map(
      (status: { id?: number | string; name?: string }) => ({
        id: Number(status.id) || 0,
        name: status.name || 'Unknown',
      })
    );

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Error fetching statuses:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch statuses' },
      { status: 500 }
    );
  }
}
