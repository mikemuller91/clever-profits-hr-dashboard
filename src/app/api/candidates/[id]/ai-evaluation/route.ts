import { NextResponse } from 'next/server';
import { evaluateCandidate, AIEvaluation } from '@/lib/ai-evaluation';
import { extractPdfText } from '@/lib/pdf-extract';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Simple in-memory cache for evaluations (in production, use Redis or a database)
const evaluationCache = new Map<string, AIEvaluation>();

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

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment variables.' },
      { status: 500 }
    );
  }

  // Check cache first
  const cached = evaluationCache.get(id);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

    // Fetch candidate details
    const detailsUrl = `${baseUrl}/applicant_tracking/applications/${id}`;
    const detailsResponse = await fetch(detailsUrl, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      console.error('ATS API error:', detailsResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch candidate: ${detailsResponse.status}` },
        { status: detailsResponse.status }
      );
    }

    const candidate = await detailsResponse.json();

    // Extract relevant data
    const jobTitle = candidate.job?.title?.label || 'Unknown Position';
    const candidateName = `${candidate.applicant?.firstName || ''} ${candidate.applicant?.lastName || ''}`.trim();
    const resumeFileId = candidate.resumeFileId;

    // Extract Q&A
    const questionsAndAnswers = (candidate.questionsAndAnswers || []).map((qa: {
      question?: { label?: string };
      answer?: { label?: string };
    }) => ({
      question: qa.question?.label || '',
      answer: qa.answer?.label || '',
    })).filter((qa: { question: string; answer: string }) => qa.question && qa.answer);

    // Try to extract resume text if available
    let resumeText: string | null = null;
    if (resumeFileId) {
      try {
        const resumeUrl = `${baseUrl}/applicant_tracking/applications/${id}/files/${resumeFileId}`;
        const resumeResponse = await fetch(resumeUrl, {
          headers: {
            'Authorization': getAuthHeader(),
          },
          cache: 'no-store',
        });

        if (resumeResponse.ok) {
          const contentType = resumeResponse.headers.get('content-type') || '';
          if (contentType.includes('pdf')) {
            const pdfBuffer = await resumeResponse.arrayBuffer();
            resumeText = await extractPdfText(pdfBuffer);
            // Limit resume text length to avoid token limits
            if (resumeText.length > 8000) {
              resumeText = resumeText.substring(0, 8000) + '... [truncated]';
            }
          }
        }
      } catch (err) {
        console.error('Error fetching/parsing resume:', err);
        // Continue without resume - Q&A may still provide useful info
      }
    }

    // Call AI evaluation
    const evaluation = await evaluateCandidate({
      jobTitle,
      resumeText,
      questionsAndAnswers,
      candidateName,
    });

    // Cache the result
    evaluationCache.set(id, evaluation);

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('Error in AI evaluation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI evaluation failed' },
      { status: 500 }
    );
  }
}
