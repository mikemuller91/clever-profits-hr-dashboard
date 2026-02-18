import { NextResponse } from 'next/server';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  if (!fileId) {
    return NextResponse.json(
      { error: 'File ID is required.' },
      { status: 400 }
    );
  }

  try {
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;
    const url = `${baseUrl}/applicant_tracking/applications/${id}/files/${fileId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ATS File API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition');

    // Get the file data as array buffer
    const fileData = await response.arrayBuffer();

    // Return the file with appropriate headers
    return new NextResponse(fileData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition || 'inline',
      },
    });
  } catch (error) {
    console.error('Error fetching resume file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch file' },
      { status: 500 }
    );
  }
}
