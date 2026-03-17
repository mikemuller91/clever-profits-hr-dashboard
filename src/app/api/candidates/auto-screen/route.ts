import { NextResponse } from 'next/server';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

// Screening rules: job ID -> { questionId, disqualifyingAnswers, statusId }
const SCREENING_RULES = [
  {
    jobId: 26, // Junior Accountant / Management Accountant / CIMA Trainee
    questionId: 77, // "What is your highest level of Qualification?"
    disqualifyingAnswers: ['Undergraduate Diploma', 'Undergraduate diploma'],
    statusId: 12, // "Not Qualified"
  },
];

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

interface ScreenResult {
  candidateId: string;
  candidateName: string;
  answer: string;
  rule: string;
}

export async function POST(request: Request) {
  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

  try {
    const body = await request.json().catch(() => ({}));
    // Accept candidate IDs to screen, or screen all new candidates for matching jobs
    const candidateIds: string[] = body.candidateIds || [];

    if (candidateIds.length === 0) {
      return NextResponse.json({ screened: 0, results: [] });
    }

    const results: ScreenResult[] = [];

    for (const candidateId of candidateIds) {
      try {
        // Fetch candidate detail to get answers
        const detailRes = await fetch(
          `${baseUrl}/applicant_tracking/applications/${candidateId}`,
          {
            headers: {
              'Authorization': getAuthHeader(),
              'Accept': 'application/json',
            },
            cache: 'no-store',
          }
        );

        if (!detailRes.ok) continue;

        const detail = await detailRes.json();
        const jobId = detail.job?.id;
        const statusId = detail.status?.id;
        const statusLabel = detail.status?.label || '';

        // Only screen candidates with "New" status (id: 1)
        if (statusId !== 1 && statusLabel !== 'New') continue;

        // Check each screening rule
        for (const rule of SCREENING_RULES) {
          if (jobId !== rule.jobId) continue;

          const qa = (detail.questionsAndAnswers || []).find(
            (q: { question?: { id?: number }; answer?: { label?: string } }) =>
              q.question?.id === rule.questionId
          );

          if (!qa?.answer?.label) continue;

          const answerLower = qa.answer.label.toLowerCase().trim();
          const isDisqualifying = rule.disqualifyingAnswers.some(
            (a) => a.toLowerCase().trim() === answerLower
          );

          if (isDisqualifying) {
            // Update status to Not Qualified
            const statusRes = await fetch(
              `${baseUrl}/applicant_tracking/applications/${candidateId}/status`,
              {
                method: 'POST',
                headers: {
                  'Authorization': getAuthHeader(),
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: rule.statusId }),
              }
            );

            if (statusRes.ok) {
              const name = `${detail.applicant?.firstName || ''} ${detail.applicant?.lastName || ''}`.trim();
              console.log(`[Auto-Screen] ${name} (${candidateId}) -> Not Qualified (answered: "${qa.answer.label}")`);
              results.push({
                candidateId,
                candidateName: name,
                answer: qa.answer.label,
                rule: `Job ${rule.jobId}: Question ${rule.questionId}`,
              });
            }
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`[Auto-Screen] Error screening candidate ${candidateId}:`, err);
      }
    }

    console.log(`[Auto-Screen] Screened ${candidateIds.length} candidates, ${results.length} marked Not Qualified`);

    return NextResponse.json({
      screened: candidateIds.length,
      disqualified: results.length,
      results,
    });
  } catch (error) {
    console.error('[Auto-Screen] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-screen failed' },
      { status: 500 }
    );
  }
}
