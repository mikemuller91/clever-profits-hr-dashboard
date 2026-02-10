import { NextResponse } from 'next/server';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

// Debug endpoint to see raw BambooHR data structure
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  try {
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;
    const url = `${baseUrl}/applicant_tracking/applications/${id}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `ATS API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    return NextResponse.json({
      message: 'Raw BambooHR candidate data',
      candidateId: id,
      data: rawData,
    });
  } catch (error) {
    console.error('Error fetching raw candidate data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch candidate' },
      { status: 500 }
    );
  }
}
