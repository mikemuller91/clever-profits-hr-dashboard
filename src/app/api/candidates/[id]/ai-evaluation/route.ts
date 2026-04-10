import { NextResponse } from 'next/server';
import { evaluateCandidate } from '@/lib/ai-evaluation';
import { extractPdfText } from '@/lib/pdf-extract';
import { getCachedEvaluation, setCachedEvaluation } from '@/lib/ai-cache';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Gemini API key not configured. Add GEMINI_API_KEY to your environment variables.' },
      { status: 500 }
    );
  }

  // Check persistent cache first (Redis)
  const cached = await getCachedEvaluation(id);
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

    // Call AI evaluation with retry for rate limits and 503 errors
    // Models to try in order (fallback if primary is unavailable)
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let evaluation;
    let lastError;

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          evaluation = await evaluateCandidate({
            jobTitle,
            resumeText,
            questionsAndAnswers,
            candidateName,
            model,
          });
          break; // Success, exit retry loop
        } catch (err) {
          lastError = err;
          const errorMessage = err instanceof Error ? err.message : '';
          const errorStr = String(err);

          // Check for retryable errors: 429 (rate limit) or 503 (service unavailable)
          const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate_limit');
          const isUnavailable = errorMessage.includes('503') || errorStr.includes('503') ||
                               errorMessage.includes('UNAVAILABLE') || errorStr.includes('high demand');

          if (isRateLimit || isUnavailable) {
            const waitTime = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s
            console.log(`[AI Evaluation] ${isRateLimit ? 'Rate limited' : 'Service unavailable'} with ${model}, waiting ${waitTime / 1000}s before retry ${attempt + 1}/3`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // Other error - don't retry, but try next model
            console.error(`[AI Evaluation] Error with ${model}:`, errorMessage);
            break;
          }
        }
      }

      if (evaluation) break; // Success with this model
      console.log(`[AI Evaluation] Failed with ${model}, trying fallback...`);
    }

    if (!evaluation) {
      const errorMessage = lastError instanceof Error ? lastError.message : 'AI evaluation failed';
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate_limit');
      const isUnavailable = errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE');

      return NextResponse.json(
        {
          error: isUnavailable ? 'AI service temporarily unavailable - please try again in a few minutes' :
                 isRateLimit ? 'Rate limited - please try again in a few minutes' : errorMessage,
          retryAfter: (isRateLimit || isUnavailable) ? 60 : undefined,
        },
        { status: isUnavailable ? 503 : isRateLimit ? 429 : 500 }
      );
    }

    // Cache the result persistently in Redis
    await setCachedEvaluation(id, evaluation);

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('Error in AI evaluation:', error);
    const errorMessage = error instanceof Error ? error.message : 'AI evaluation failed';
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('rate_limit');
    const isUnavailable = errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE');

    return NextResponse.json(
      {
        error: isUnavailable ? 'AI service temporarily unavailable - please try again in a few minutes' :
               isRateLimit ? 'Rate limited - please try again in a few minutes' : errorMessage,
        retryAfter: (isRateLimit || isUnavailable) ? 60 : undefined,
      },
      { status: isUnavailable ? 503 : isRateLimit ? 429 : 500 }
    );
  }
}
