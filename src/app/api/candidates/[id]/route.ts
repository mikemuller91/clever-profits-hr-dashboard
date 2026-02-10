import { NextResponse } from 'next/server';
import { CandidateDetail } from '@/types/candidates';

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
      console.error('ATS API error:', response.status, errorText);
      return NextResponse.json(
        { error: `ATS API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const app = await response.json();

    const candidate: CandidateDetail = {
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
      statusChangedDate: app.status?.dateChanged || '',
      appliedDate: app.appliedDate || '',
      source: app.applicant?.source || '',
      linkedinUrl: app.applicant?.linkedinUrl || '',
      websiteUrl: app.applicant?.websiteUrl || '',
      address: app.applicant?.address ? {
        line1: app.applicant.address.addressLine1 || '',
        city: app.applicant.address.city || '',
        state: app.applicant.address.state || '',
        zipcode: app.applicant.address.zipcode || '',
        country: app.applicant.address.country || '',
      } : null,
      availableStartDate: app.applicant?.availableStartDate || '',
      desiredSalary: app.desiredSalary || '',
      referredBy: app.referredBy || '',
      resumeFileId: app.resumeFileId || null,
      coverLetterFileId: app.coverLetterFileId || null,
      questionsAndAnswers: (app.questionsAndAnswers || []).map((qa: {
        question?: { label?: string };
        answer?: { label?: string };
      }) => ({
        question: qa.question?.label || '',
        answer: qa.answer?.label || '',
      })),
      hiringLead: app.job?.hiringLead ? {
        name: `${app.job.hiringLead.firstName || ''} ${app.job.hiringLead.lastName || ''}`.trim(),
        employeeId: app.job.hiringLead.employeeId,
      } : null,
    };

    return NextResponse.json(candidate);
  } catch (error) {
    console.error('Error fetching candidate detail:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch candidate' },
      { status: 500 }
    );
  }
}
