import { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

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

    const applications = await appsResponse.json();
    const results: SearchResult[] = [];

    // Process each application
    for (const app of applications) {
      const matches: SearchResult['matches'] = [];
      const candidateId = String(app.id);
      const candidateName = `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.trim();
      const email = app.applicant?.email || '';
      const jobTitle = app.job?.title?.label || '';

      // Search in questions and answers
      const questionsAndAnswers = app.questionsAndAnswers || [];
      for (const qa of questionsAndAnswers) {
        const question = qa.question?.label || '';
        const answer = qa.answer?.label || '';

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
      if (searchCv && app.resumeFileId) {
        try {
          const cvUrl = `${baseUrl}/applicant_tracking/applications/${candidateId}/files/${app.resumeFileId}`;
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
              const pdfData = await pdfParse(Buffer.from(pdfBuffer));
              const cvText = pdfData.text.toLowerCase();

              if (cvText.includes(searchTerm)) {
                // Find the excerpt containing the search term
                const index = cvText.indexOf(searchTerm);
                const start = Math.max(0, index - 50);
                const end = Math.min(cvText.length, index + searchTerm.length + 50);
                let excerpt = pdfData.text.substring(start, end).trim();

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
          jobTitle,
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
