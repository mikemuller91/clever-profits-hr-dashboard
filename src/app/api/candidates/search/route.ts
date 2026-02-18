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

interface Application {
  id?: string | number;
  applicant?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  job?: {
    id?: number;
    title?: { label?: string };
  };
  questionsAndAnswers?: Array<{
    question?: { label?: string };
    answer?: { label?: string };
  }>;
  resumeFileId?: number;
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

    // Helper function to delay between requests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper function to fetch with retry on rate limit
    const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        const response = await fetch(url, options);
        if (response.status === 503 || response.status === 429) {
          // Rate limited - wait and retry
          await delay(1000 * (i + 1)); // Exponential backoff
          continue;
        }
        return response;
      }
      return fetch(url, options); // Final attempt
    };

    // Fetch all applications (with pagination)
    let allApplications: Application[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      let applicationsUrl = `${baseUrl}/applicant_tracking/applications?page=${page}`;
      if (jobId) {
        applicationsUrl += `&jobId=${jobId}`;
      }

      const appsResponse = await fetchWithRetry(applicationsUrl, {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!appsResponse.ok) {
        throw new Error(`Failed to fetch applications: ${appsResponse.status}`);
      }

      const data = await appsResponse.json();
      const applications = Array.isArray(data) ? data : (data.applications || data.data || []);

      if (applications.length === 0) {
        hasMore = false;
      } else {
        allApplications = [...allApplications, ...applications];
        page++;
        if (page > 100) hasMore = false; // Safety limit
      }

      // Small delay between pagination requests
      if (hasMore) await delay(200);
    }

    const results: SearchResult[] = [];

    // Fetch detailed info for each application and search
    // Process in batches to avoid overwhelming the API
    const batchSize = 3;

    for (let i = 0; i < allApplications.length; i += batchSize) {
      const batch = allApplications.slice(i, i + batchSize);

      const batchPromises = batch.map(async (app) => {
        const candidateId = String(app.id || '');
        const matches: SearchResult['matches'] = [];

        // Fetch detailed application info to get questionsAndAnswers
        let detailedApp = app;
        try {
          const detailUrl = `${baseUrl}/applicant_tracking/applications/${candidateId}`;
          const detailResponse = await fetchWithRetry(detailUrl, {
            headers: {
              'Authorization': getAuthHeader(),
              'Accept': 'application/json',
            },
            cache: 'no-store',
          });

          if (detailResponse.ok) {
            detailedApp = await detailResponse.json();
          }
        } catch (err) {
          console.error(`Error fetching details for ${candidateId}:`, err);
        }

        const candidateName = `${detailedApp.applicant?.firstName || ''} ${detailedApp.applicant?.lastName || ''}`.trim();
        const email = detailedApp.applicant?.email || '';
        const jobTitleLabel = detailedApp.job?.title?.label || '';

        // Search in questions and answers
        const questionsAndAnswers = detailedApp.questionsAndAnswers || [];
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
        const resumeFileId = detailedApp.resumeFileId;
        if (searchCv && resumeFileId) {
          try {
            const cvUrl = `${baseUrl}/applicant_tracking/applications/${candidateId}/files/${resumeFileId}`;
            const cvResponse = await fetchWithRetry(cvUrl, {
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
                  const index = cvText.indexOf(searchTerm);
                  const start = Math.max(0, index - 50);
                  const end = Math.min(cvText.length, index + searchTerm.length + 50);
                  let excerpt = pdfText.substring(start, end).trim();

                  excerpt = excerpt.replace(/\s+/g, ' ');
                  if (start > 0) excerpt = '...' + excerpt;
                  if (end < cvText.length) excerpt = excerpt + '...';

                  matches.push({
                    type: 'cv',
                    cvExcerpt: excerpt,
                  });
                }
              } else if (contentType.includes('text') || contentType.includes('word')) {
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
          }
        }

        if (matches.length > 0) {
          return {
            candidateId,
            candidateName,
            email,
            jobTitle: jobTitleLabel,
            matches,
          };
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is SearchResult => r !== null));

      // Delay between batches to avoid rate limiting
      if (i + batchSize < allApplications.length) {
        await delay(500);
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
