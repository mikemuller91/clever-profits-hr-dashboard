import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { candidateIds, force = false } = await request.json();

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: 'candidateIds array is required' },
        { status: 400 }
      );
    }

    // Limit to 50 candidates at a time
    const idsToProcess = candidateIds.slice(0, 50);

    // Get the base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                    'http://localhost:3000';

    const results: { candidateId: string; success: boolean; error?: string }[] = [];

    // Process candidates with rate limiting (15 second delay between requests)
    for (let i = 0; i < idsToProcess.length; i++) {
      const candidateId = idsToProcess[i];

      try {
        const url = `${baseUrl}/api/candidates/${candidateId}/ai-evaluation${force ? '?force=true' : ''}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          results.push({ candidateId, success: true });
          console.log(`[Bulk AI] Evaluated candidate ${candidateId} (${i + 1}/${idsToProcess.length})`);
        } else {
          const errorData = await response.json();
          results.push({ candidateId, success: false, error: errorData.error });
          console.log(`[Bulk AI] Failed candidate ${candidateId}: ${errorData.error}`);
        }
      } catch (err) {
        results.push({
          candidateId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }

      // Rate limit: wait 15 seconds between requests (except for last one)
      if (i < idsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      processed: idsToProcess.length,
      success: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error('Error in bulk AI evaluation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk evaluation failed' },
      { status: 500 }
    );
  }
}
