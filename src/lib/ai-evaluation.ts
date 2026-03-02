import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

  const prompt = `You are evaluating a job candidate for the position of "${jobTitle}" at an OUTSOURCED ACCOUNTING FIRM (similar to fractional CFO services).

COMPANY CONTEXT:
We are an outsourced accounting firm providing fractional CFO and accounting services to clients. This context is crucial for evaluating candidates.

QUALIFICATION HIERARCHY (highest to lowest value):
1. Professional Designations (HIGHEST VALUE): CA(SA), CPA, ACCA, CGMA, CMA - these are TOP TIER
2. Masters Degree: MCom, MBA, MAcc, etc.
3. Post-Graduate Honours: BCom Hons, BAcc Hons, etc. (note: this is STRONGER than a Post-Grad Diploma)
4. Post-Graduate Diploma: PGDip (note: this is WEAKER than Honours)
5. Bachelor's Degree: BCom, BAcc, etc.
6. National Diploma
7. Certificate (lowest)

EXPERIENCE HIERARCHY (highest to lowest value):
1. MOST VALUABLE: Outsourced accounting / fractional CFO / outsourced CFO services experience
   - Specific high-value employers: "Outsourced CFO", "Creative CFO", "Iridium" (these are direct competitors in South Africa)
   - Any similar outsourced accounting/bookkeeping firm experience is highly valuable
2. SECOND TIER: Big 4 audit firms (Deloitte, PwC, EY, KPMG) or mid-tier audit firm experience
3. THIRD TIER: General corporate accounting experience
4. LOWEST: Unrelated experience

SCORING GUIDELINES:
- Score candidates RELATIVE to the specific role "${jobTitle}"
- For entry-level/trainee positions: 2-3 years experience is excellent, no experience is acceptable if education is good
- For senior/manager positions: 5+ years experience is expected, 10+ years is excellent
- For executive positions (Director, Controller, CFO): 10+ years is expected, leadership experience is crucial
- BOOST scores for: outsourced accounting experience, professional designations (CA/CPA/CGMA), competitor firm experience
- A score of 10/10 should be rare - reserved for candidates who exceed all expectations

CANDIDATE INFORMATION:

Name: ${candidateName}

${resumeText ? `RESUME CONTENT:\n${resumeText}\n` : 'RESUME: Not available\n'}

APPLICATION Q&A:
${qaText}

Based on this information, provide an evaluation in the following JSON format:
{
  "score": <number 1-10 relative to this specific role>,
  "summary": "<2-3 sentence summary highlighting their qualifications and experience relevance to outsourced accounting>",
  "strengths": ["<strength 1>", "<strength 2>", "<optional strength 3>"],
  "concerns": ["<concern 1 if any>", "<concern 2 if any>"]
}

Remember:
- Score is relative to "${jobTitle}" at an outsourced accounting firm
- Explicitly mention if they have outsourced/fractional CFO experience (this is gold)
- Explicitly mention their highest qualification level
- Note if they worked at competitor firms (Outsourced CFO, Creative CFO, Iridium) or Big 4
- Strengths should highlight what makes them specifically good for outsourced accounting work
- Concerns can be empty if no significant issues, but be honest about gaps
- Keep strengths and concerns concise (under 15 words each)

Respond with only valid JSON, no other text.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error('No text response from AI');
  }

  // Parse the JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
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
