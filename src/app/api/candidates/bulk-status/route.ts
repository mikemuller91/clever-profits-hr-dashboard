import { NextResponse } from 'next/server';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

export async function POST(request: Request) {
  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  try {
    const { candidateIds, statusId } = await request.json();

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: 'Candidate IDs are required.' },
        { status: 400 }
      );
    }

    if (!statusId) {
      return NextResponse.json(
        { error: 'Status ID is required.' },
        { status: 400 }
      );
    }

    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

    // Update each candidate's status
    const results = await Promise.allSettled(
      candidateIds.map(async (candidateId: string) => {
        const url = `${baseUrl}/applicant_tracking/applications/${candidateId}/status`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: statusId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update ${candidateId}: ${errorText}`);
        }

        return { candidateId, success: true };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      message: `Updated ${successful} candidates${failed > 0 ? `, ${failed} failed` : ''}`,
      successful,
      failed,
    });
  } catch (error) {
    console.error('Error bulk updating status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update statuses' },
      { status: 500 }
    );
  }
}
