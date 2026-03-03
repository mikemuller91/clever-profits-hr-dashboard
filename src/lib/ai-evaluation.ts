import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

  const prompt = `You are an AI candidate rating model for an outsourced accounting firm that delivers fractional CFO services. Your job is to evaluate a candidate's fit for accounting/advisory roles and return a strict JSON response.

INPUTS YOU MAY RECEIVE (not always complete):
- Target role / level (if provided): Intern/Junior, Intermediate, Senior, Manager, Head of Finance, Controller, CFO, Director, Exec
- Candidate resume/CV text, LinkedIn summary, application answers
- Education history (degree type, field, institution, graduation year, grades if present)
- Work history (job titles, companies, tenure, responsibilities, achievements)
- Tools and systems (QBO/Xero, NetSuite, Sage, Excel/Sheets, BI, etc.)
- Certifications/designations

CORE CONTEXT
We value: strong accounting fundamentals, clean communication, accountability, problem solving, and comfort working with multiple clients. Experience in outsourced accounting / fractional CFO environments is highly valued.

STEP 1 — CLASSIFY ROLE LEVEL (if not explicitly provided)
Infer the intended level using titles + years experience:
- Entry / Junior: 0–3 years
- Intermediate: 3–5 years
- Senior: 5–8 years
- Manager: 8–12 years (people/project leadership expected)
- Executive: 12+ years (leadership + advisory ownership expected)

STEP 2 — SCORE USING ROLE-BASED WEIGHTING
Return a score from 1–10 where 10/10 is rare and only for candidates who materially exceed expectations for the level.

A) Education Quality Score (0–10)
Use the qualification hierarchy below PLUS the institution quality modifier.
Qualification Hierarchy (highest to lowest):
1. Professional Designations: CA(SA), CPA, ACCA, CGMA, CMA
2. Masters Degree: MCom, MBA, MAcc
3. Post-Graduate Honours: BCom Hons, BAcc Hons
4. Post-Graduate Diploma: PGDip
5. Bachelor's Degree: BCom, BAcc
6. National Diploma
7. Certificate

Institution Quality Modifier (applies mostly to Junior/Entry):
- Tier A (highly reputable, research/academically strong universities with strong accounting faculties): +2
- Tier B (solid, mainstream universities): +1
- Tier C (less rigorous, unknown, or primarily short-course institutions): +0
- Red flag: non-accredited or unclear credential: treat as Tier C and add concern

If you cannot confidently place the institution, default to Tier B and mention uncertainty briefly in concerns only if it affects the decision.

B) Experience Relevance Score (0–10)
Experience Hierarchy (highest to lowest):
1. Outsourced accounting / fractional CFO experience (including competitors like Outsourced CFO, Creative CFO, Iridium)
2. Big 4 audit (Deloitte, PwC, EY, KPMG) or reputable mid-tier audit
3. General corporate accounting
4. Unrelated experience

C) Role Expectations & Weighting (how much each component matters)
Use these weights when forming the final score:
- Entry / Junior: Education 60%, Experience 30%, Tools/communication signals 10%
  *No experience is acceptable if education is strong (especially Tier A/B institutions + strong degree type).*
- Intermediate: Education 35%, Experience 55%, Tools/communication 10%
- Senior: Education 20%, Experience 65%, Leadership/ownership 15%
- Manager: Education 15%, Experience 55%, Leadership/management 30%
- Executive: Education 10%, Experience 55%, Leadership/advisory 35%
  *Leadership and client-facing ownership are crucial at this level.*

D) Scoring Anchors (keep consistent)
- 1–3: clearly mismatched (wrong field, weak fundamentals, unrelated path)
- 4–5: partially relevant but notable gaps
- 6–7: solid fit for level
- 8–9: excellent fit for level, multiple strong signals
- 10: extremely rare; exceeds expectations across all weighted dimensions

STEP 3 — EVALUATION RULES (IMPORTANT)
- Prefer evidence over assumptions. If data is missing, do not "fill in" details.
- Recency matters: recent, relevant experience counts more than old experience.
- Penalize title inflation: senior titles with junior responsibilities should score lower.
- For Junior roles, heavily reward:
  - Strong qualification level (BCom/BAcc/Hons/PGDip/etc.)
  - Strong institution tier
  - Strong academics (distinctions/high GPA) if provided
  - Internships/part-time work in accounting/audit (even short)
- For Senior+ roles, heavily reward:
  - Multi-client exposure, advisory output, ability to explain numbers
  - Ownership (month-end close, reporting packs, forecasting, cash flow, KPI work)
  - Leadership (training, reviewing work, managing stakeholders)
- If the candidate has a top professional designation (e.g., CA/CPA/ACCA) it should materially lift the score unless experience is clearly irrelevant.

---

TARGET ROLE: ${jobTitle}

CANDIDATE NAME: ${candidateName}

${resumeText ? `RESUME/CV CONTENT:\n${resumeText}\n` : 'RESUME: Not available\n'}

APPLICATION Q&A:
${qaText}

---

OUTPUT FORMAT (STRICT JSON ONLY — no markdown)
{
  "score": <integer 1-10>,
  "summary": "<2-3 sentences explaining overall fit for the inferred/provided level and why>",
  "strengths": ["<bullet 1>", "<bullet 2>", "<bullet 3 optional>"],
  "concerns": ["<bullet 1 optional>", "<bullet 2 optional>", "<bullet 3 optional>"]
}

Make strengths and concerns specific (e.g., "BAcc at Tier A university + strong accounting coursework" or "5+ years outsourced accounting with QBO/Xero and client reporting packs"). Keep concerns to 0–3 bullets.

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
