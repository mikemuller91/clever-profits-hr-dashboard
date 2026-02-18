import { NextResponse } from 'next/server';
import { extractText } from 'unpdf';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

interface SearchResult {
  candidateId: string;
  candidateName: string;
  email: string;
  jobTitle: string;
  matches: {
    type: 'question' | 'cv';
    question?: string;
    answer?: string;
    cvExcerpt?: string;
  }[];
}

export async function POST(request: Request) {
  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  try {
    const { keyword, jobId, searchCv = false } = await request.json();

    if (!keyword || keyword.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search keyword must be at least 2 characters.' },
        { status: 400 }
      );
    }

    const searchTerm = keyword.toLowerCase().trim();
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

    // Fetch all applications for the job
    let applicationsUrl = `${baseUrl}/applicant_tracking/applications`;
    if (jobId) {
      applicationsUrl += `?jobId=${jobId}`;
    }

    const appsResponse = await fetch(applicationsUrl, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!appsResponse.ok) {
      throw new Error(`Failed to fetch applications: ${appsResponse.status}`);
    }

    const applicationsData = await appsResponse.json();

    // Handle different response formats from BambooHR
    let applications: unknown[];
    if (Array.isArray(applicationsData)) {
      applications = applicationsData;
    } else if (applicationsData.applications && Array.isArray(applicationsData.applications)) {
      applications = applicationsData.applications;
    } else {
      applications = [];
    }

    const results: SearchResult[] = [];

    // Process each application
    for (const appData of applications) {
      const app = appData as Record<string, unknown>;
      const matches: SearchResult['matches'] = [];
      const candidateId = String(app.id || '');

      const applicant = app.applicant as Record<string, unknown> | undefined;
      const job = app.job as Record<string, unknown> | undefined;
      const jobTitle = job?.title as Record<string, unknown> | undefined;

      const candidateName = `${applicant?.firstName || ''} ${applicant?.lastName || ''}`.trim();
      const email = String(applicant?.email || '');
      const jobTitleLabel = String(jobTitle?.label || '');

      // Search in questions and answers
      const questionsAndAnswers = (app.questionsAndAnswers as unknown[]) || [];
      for (const qaData of questionsAndAnswers) {
        const qa = qaData as Record<string, unknown>;
        const questionObj = qa.question as Record<string, unknown> | undefined;
        const answerObj = qa.answer as Record<string, unknown> | undefined;
        const question = String(questionObj?.label || '');
        const answer = String(answerObj?.label || '');

        if (
          question.toLowerCase().includes(searchTerm) ||
          answer.toLowerCase().includes(searchTerm)
        ) {
          matches.push({
            type: 'question',
            question,
            answer,
          });
        }
      }

      // Search in CV if requested and resumeFileId exists
      const resumeFileId = app.resumeFileId as number | undefined;
      if (searchCv && resumeFileId) {
        try {
          const cvUrl = `${baseUrl}/applicant_tracking/applications/${candidateId}/files/${resumeFileId}`;
          const cvResponse = await fetch(cvUrl, {
            headers: {
              'Authorization': getAuthHeader(),
            },
            cache: 'no-store',
          });

          if (cvResponse.ok) {
            const contentType = cvResponse.headers.get('content-type') || '';

            if (contentType.includes('pdf')) {
              const pdfBuffer = await cvResponse.arrayBuffer();
              const { text: pdfTextArray } = await extractText(new Uint8Array(pdfBuffer));
              const pdfText = Array.isArray(pdfTextArray) ? pdfTextArray.join(' ') : String(pdfTextArray);
              const cvText = pdfText.toLowerCase();

              if (cvText.includes(searchTerm)) {
                // Find the excerpt containing the search term
                const index = cvText.indexOf(searchTerm);
                const start = Math.max(0, index - 50);
                const end = Math.min(cvText.length, index + searchTerm.length + 50);
                let excerpt = pdfText.substring(start, end).trim();

                // Clean up the excerpt
                excerpt = excerpt.replace(/\s+/g, ' ');
                if (start > 0) excerpt = '...' + excerpt;
                if (end < cvText.length) excerpt = excerpt + '...';

                matches.push({
                  type: 'cv',
                  cvExcerpt: excerpt,
                });
              }
            } else if (contentType.includes('text') || contentType.includes('word')) {
              // Handle text/word documents
              const text = await cvResponse.text();
              if (text.toLowerCase().includes(searchTerm)) {
                const index = text.toLowerCase().indexOf(searchTerm);
                const start = Math.max(0, index - 50);
                const end = Math.min(text.length, index + searchTerm.length + 50);
                let excerpt = text.substring(start, end).trim();

                excerpt = excerpt.replace(/\s+/g, ' ');
                if (start > 0) excerpt = '...' + excerpt;
                if (end < text.length) excerpt = excerpt + '...';

                matches.push({
                  type: 'cv',
                  cvExcerpt: excerpt,
                });
              }
            }
          }
        } catch (cvError) {
          console.error(`Error parsing CV for candidate ${candidateId}:`, cvError);
          // Continue with other candidates even if one CV fails
        }
      }

      if (matches.length > 0) {
        results.push({
          candidateId,
          candidateName,
          email,
          jobTitle: jobTitleLabel,
          matches,
        });
      }
    }

    return NextResponse.json({
      keyword,
      totalResults: results.length,
      results,
    });
  } catch (error) {
    console.error('Error searching candidates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
