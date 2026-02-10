import { NextResponse } from 'next/server';

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

    // Fetch first page of applications to inspect structure
    const applicationsUrl = `${baseUrl}/applicant_tracking/applications?page=1`;
    const applicationsResponse = await fetch(applicationsUrl, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!applicationsResponse.ok) {
      const errorText = await applicationsResponse.text();
      return NextResponse.json(
        { error: `ATS API error: ${applicationsResponse.status} - ${errorText}` },
        { status: applicationsResponse.status }
      );
    }

    const applicationsData = await applicationsResponse.json();
    const applications = Array.isArray(applicationsData)
      ? applicationsData
      : (applicationsData.applications || applicationsData.data || []);

    // Get first application to show structure
    const firstApp = applications[0] || null;
    const allKeys = firstApp ? getAllKeys(firstApp) : [];

    // Try to get a single application detail if we have an ID
    let applicationDetail = null;
    if (firstApp?.id) {
      const detailUrl = `${baseUrl}/applicant_tracking/applications/${firstApp.id}`;
      const detailResponse = await fetch(detailUrl, {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });
      if (detailResponse.ok) {
        applicationDetail = await detailResponse.json();
      }
    }

    return NextResponse.json({
      message: 'Debug endpoint - showing raw BambooHR ATS data structure',
      applicationsEndpoint: {
        url: applicationsUrl,
        sampleCount: applications.length,
        firstApplication: firstApp,
        allKeysFound: allKeys,
      },
      applicationDetailEndpoint: applicationDetail ? {
        url: `${baseUrl}/applicant_tracking/applications/${firstApp?.id}`,
        data: applicationDetail,
        allKeysFound: getAllKeys(applicationDetail),
      } : null,
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch debug data' },
      { status: 500 }
    );
  }
}

// Helper to get all keys including nested objects
function getAllKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];

  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      keys.push(...getAllKeys(value[0], `${fullKey}[0]`));
    }
  }
  return keys;
}
