import { NextResponse } from 'next/server';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

export async function POST(
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
    const body = await request.json();
    const rawStatusId = body.statusId;

    // Accept both string and number, convert to number
    const statusId = Number(rawStatusId);
    if (!rawStatusId || isNaN(statusId)) {
      return NextResponse.json(
        { error: 'statusId is required and must be a valid number' },
        { status: 400 }
      );
    }

    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;
    const url = `${baseUrl}/applicant_tracking/applications/${id}/status`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: statusId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ATS Status Update API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to update status: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // BambooHR may return empty response on success
    let data = {};
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // Empty or non-JSON response is okay for POST
      }
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update status' },
      { status: 500 }
    );
  }
}
