import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AIEvaluation {
  score: number; // 1-10
  summary: string; // 2-3 sentences
  strengths: string[]; // 2-3 bullet points
  concerns: string[]; // 0-3 bullet points
  generatedAt: string;
}

interface EvaluationInput {
  jobTitle: string;
  resumeText: string | null;
  questionsAndAnswers: Array<{ question: string; answer: string }>;
  candidateName: string;
}

export async function evaluateCandidate(input: EvaluationInput): Promise<AIEvaluation> {
  const { jobTitle, resumeText, questionsAndAnswers, candidateName } = input;

  // Format Q&A for the prompt
  const qaText = questionsAndAnswers.length > 0
    ? questionsAndAnswers.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
    : 'No application questions answered.';

  const prompt = `You are evaluating a job candidate for the position of "${jobTitle}".

IMPORTANT CONTEXT FOR SCORING:
- Score candidates RELATIVE to the specific role they're applying for
- For entry-level/trainee positions: 2-3 years experience is excellent (8-9/10), no experience is acceptable (5-6/10 if other factors are good)
- For senior/manager positions: 5+ years experience is expected (6-7/10), 10+ years is excellent (8-9/10)
- For executive positions (Director, Controller, CFO): 10+ years is expected, leadership experience is crucial
- A score of 10/10 should be rare - reserved for candidates who exceed all expectations for the role

CANDIDATE INFORMATION:

Name: ${candidateName}

${resumeText ? `RESUME CONTENT:\n${resumeText}\n` : 'RESUME: Not available\n'}

APPLICATION Q&A:
${qaText}

Based on this information, provide an evaluation in the following JSON format:
{
  "score": <number 1-10 relative to this specific role>,
  "summary": "<2-3 sentence summary of candidate's fit for THIS role>",
  "strengths": ["<strength 1>", "<strength 2>", "<optional strength 3>"],
  "concerns": ["<concern 1 if any>", "<concern 2 if any>"]
}

Remember:
- Score is relative to "${jobTitle}" - adjust expectations based on seniority level
- Summary should highlight the most relevant qualifications for this specific role
- Strengths should be specific and relevant to the position
- Concerns can be empty if no significant issues, but be honest about gaps
- Keep strengths and concerns concise (under 15 words each)

Respond with only valid JSON, no other text.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract the text content
  const textContent = message.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Parse the JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse AI response as JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    score: Math.max(1, Math.min(10, Number(parsed.score) || 5)),
    summary: parsed.summary || 'Unable to generate summary.',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 3) : [],
    generatedAt: new Date().toISOString(),
  };
}
