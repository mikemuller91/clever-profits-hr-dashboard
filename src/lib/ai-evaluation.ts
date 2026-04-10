import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ScoreBreakdown {
  education_score: number;
  experience_score: number;
  well_rounded_score: number;
  raw_score: number;
  final_score: number;
  caps_applied: string[];
}

export interface AIEvaluation {
  score: number; // 1-10
  score_breakdown?: ScoreBreakdown;
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

  const prompt = `You are an AI candidate rating model for an outsourced accounting firm that delivers fractional CFO services. Your job is to evaluate a candidate against (1) our internal rubric and (2) an industry-norms sanity check so scores don't inflate. Return STRICT JSON only.

INPUTS YOU MAY RECEIVE (not always complete):
- Target role / level (if provided): Intern/Junior, Intermediate, Senior, Manager, Executive
- Resume/CV text, LinkedIn summary, application answers
- Education (degree type, field, institution, graduation year, grades if present)
- Work history (titles, companies, tenure, responsibilities, achievements)
- Certifications/designations and tools

CORE DEFINITION: WHAT "PRIME CANDIDATE" MEANS
A prime candidate has ALL THREE:
1) Sufficient experience in a similar role (relevant, recent, demonstrable responsibilities)
2) Great academic record + strong qualifications (right level + credible institution)
3) A well-rounded CV (clear progression, stable tenure, strong tools exposure, evidence of impact, communication/client-facing signals)
Missing any one area should meaningfully reduce the score.

STEP 1 — CLASSIFY ROLE LEVEL (if not explicitly provided)
Infer using titles + years + scope:
- Entry / Junior: 0–3 years
- Intermediate: 3–5 years
- Senior: 5–8 years (independent ownership expected)
- Manager: 8–12 years (review/leadership expected)
- Executive: 12+ years (leadership + advisory ownership expected)

STEP 2 — INTERNAL RUBRIC SCORING (RAW) — EVIDENCE-BASED
IMPORTANT: Only award high sub-scores when there is explicit evidence in the resume/application. If evidence is missing or unclear, score conservatively and add a concern if it materially affects the rating. Do NOT infer missing institutions, grades, responsibilities, or tools.

2A) Education & Qualification Score (0–10)
Qualification hierarchy (highest to lowest):
1. Professional Designations: CA(SA), CPA, ACCA, CGMA, CMA
2. Masters: MCom, MBA, MAcc
3. Honours: BCom Hons, BAcc Hons
4. Post-Grad Diploma: PGDip
5. Bachelor's: BCom, BAcc
6. National Diploma
7. Certificate

Institution quality modifier (especially important for Entry/Junior):
- Tier A (highly reputable universities with strong accounting faculties): +2
- Tier B (solid mainstream universities): +1
- Tier C (unknown/less rigorous/short-course focused): +0
- Non-accredited/unclear credential: treat as Tier C and add concern

Academic performance modifier (only if evidence exists):
- Distinctions/high GPA/top percentile: +1
- No academic data provided: +0 (do NOT assume)

Missing-info penalty (especially for Junior/Entry):
- If institution is missing/unclear for Junior/Entry → deduct 1 point from FINAL_SCORE in Step 3 (and add concern).

2B) Experience Relevance Score (0–10)
Experience hierarchy (highest to lowest):
1. Outsourced accounting / fractional CFO (incl. competitors like Outsourced CFO, Creative CFO, Iridium)
2. Big 4 audit (Deloitte, PwC, EY, KPMG) or reputable mid-tier audit
3. General corporate accounting
4. Unrelated

Experience depth requirements (by level — apply as penalties/caps if not met):
- Entry/Junior: 0–3 years OK; internships help; no experience acceptable with strong education
- Intermediate: expect 3+ years relevant accounting
- Senior: expect 5+ years relevant + ownership of month-end/reporting
- Manager: expect 8+ years relevant + review/leadership
- Executive: expect 12+ years + leadership + advisory/client ownership

If tenure/years are unclear → cap FINAL_SCORE at 7 until proven and add concern.

2C) Well-Rounded CV Score (0–10)
Score based on evidence of:
- Progression and stability (reasonable tenure, clear growth)
- Impact (outcomes, metrics, improvements, examples)
- Tools/systems (QBO/Xero, Excel/Sheets, ERPs, reporting)
- Communication/client-facing signals (stakeholder management, presenting, writing clarity)
- Leadership where appropriate
Risk flags reduce this score: job-hopping without explanation, inconsistent dates, unexplained gaps, vague responsibilities, no tools listed, no outcomes, poor clarity.

2D) Compute RAW SCORE using role weights
Weights:
- Entry/Junior: Education 60%, Experience 25%, Well-rounded 15%
- Intermediate: Education 35%, Experience 50%, Well-rounded 15%
- Senior: Education 20%, Experience 60%, Well-rounded 20%
- Manager: Education 15%, Experience 55%, Well-rounded 30%
- Executive: Education 10%, Experience 55%, Well-rounded 35%

RAW_SCORE = weighted average of the three sub-scores, then round to nearest integer (1–10).

STEP 3 — INDUSTRY-NORMS SANITY CHECK (ANTI-INFLATION) — REQUIRED
Apply this second check so scores align with realistic market norms for outsourced accounting/fractional finance roles. If uncertain between two scores, choose the LOWER score.

3A) Role-specific must-haves (missing must-haves triggers caps)
Entry/Junior MUST-HAVES:
- Accounting/finance degree (or in-progress) AND field relevance is clear
- Institution is stated (or credible evidence) OR strong academic evidence exists
- At least one proof point of accounting exposure (internship/articles/bookkeeping/projects) OR exceptionally strong academics at Tier A/B

Intermediate MUST-HAVES:
- 3+ years relevant accounting (or close with strong evidence)
- Core month-end/recon/reporting exposure
- Tools: Excel/Sheets + at least one accounting system (QBO/Xero/ERP)

Senior MUST-HAVES:
- Ownership of month-end close and reporting packs (clear accountability)
- Client/stakeholder communication evidence
- Strong tools: QBO/Xero + Excel/Sheets (or equivalent)

Manager MUST-HAVES:
- Review/sign-off responsibility (work review, QA, final checks)
- Leadership (mentoring/training/resource planning) OR delivery management
- Advisory output (forecasting/cash flow/KPIs) evidence

Executive MUST-HAVES:
- Leadership track record (teams, strategy, accountability)
- Advisory/client ownership (recommendations, influencing decisions)
- High-level finance ownership (forecasting, cash, KPIs, board/executive reporting)

Must-have cap rule:
- If missing 1 must-have → cap FINAL_SCORE at 7 (unless overwhelming evidence elsewhere)
- If missing 2+ must-haves → cap FINAL_SCORE at 6
- If missing 3+ must-haves → FINAL_SCORE typically 1–5 depending on relevance

3B) Score bands (default ceilings unless clearly exceeded with evidence)
- Entry/Junior: 8–9 requires strong degree (Bachelor/Honours+) + Tier A/B + strong academics OR standout practical proof; 10 almost never
- Intermediate: 8–9 requires 3–5 years clearly relevant + delivery evidence + good education
- Senior+: 8–9 requires clear ownership + strong relevance + strong delivery evidence; 10 only for rare "exceeds across all pillars" candidates

3C) Gate-and-cap rules (apply in order)
GATE 1 — Experience gate:
- If Senior+ and candidate lacks expected years/scope → cap at 6
- If Intermediate and lacks 3+ relevant years → cap at 6 (exception: exceptional education + strong practical evidence → cap at 7)

GATE 2 — Prime Candidate completeness gate:
Check pillars:
A) sufficient similar experience
B) strong academics/qualifications
C) well-rounded CV
If missing 1 pillar → reduce FINAL_SCORE by 1–2
If missing 2 pillars → reduce by 3–4
If missing all 3 → FINAL_SCORE should be 1–3

GATE 3 — Education inflation control (esp. PGDip + limited experience):
- PGDip + <2 years relevant + no strong institution/academics proof → cap at 6
- PGDip + Tier A/B + strong academics + internships/projects → may reach 7–8 (8 only if exceptionally strong overall)

GATE 4 — 10/10 rule:
- 10/10 is reserved for candidates who materially exceed expectations across ALL weighted dimensions AND pass sanity check.
- If any major gap exists (education weak OR experience weak OR CV not well-rounded), FINAL_SCORE cannot be 10.

3D) Rating scale calibration (for decision usefulness)
Interpret scores as:
- 1–4: reject / clearly weak fit
- 5–6: borderline / hold
- 7: shortlist
- 8–9: priority interview (top-tier for role)
- 10: unicorn (rare; only with exceptional evidence)

3E) Final score selection
Start with RAW_SCORE, apply caps from missing info + must-haves + gates, then apply pillar reductions.
Keep FINAL_SCORE conservative when uncertain. Do not over-reward credentials without evidence of capability for the level.

STEP 4 — OUTPUT RULES (STRICT)
- Prefer evidence over assumptions; missing info should not score highly.
- Penalize vague experience, unclear tenure, and lack of outcomes.
- When uncertain between two scores, choose the lower one.

---

TARGET ROLE: ${jobTitle}

CANDIDATE NAME: ${candidateName}

${resumeText ? `RESUME/CV CONTENT:\n${resumeText}\n` : 'RESUME: Not available\n'}

APPLICATION Q&A:
${qaText}

---

OUTPUT (STRICT JSON ONLY — NO MARKDOWN)
{
  "score": <integer 1-10>,
  "score_breakdown": {
    "education_score": <number 0-10>,
    "experience_score": <number 0-10>,
    "well_rounded_score": <number 0-10>,
    "raw_score": <integer 1-10>,
    "final_score": <integer 1-10>,
    "caps_applied": ["<cap_or_gate_identifier_optional>", "<...optional>"]
  },
  "summary": "<2-3 sentences: fit for inferred/provided level + why, referencing both rubric + sanity check>",
  "strengths": ["<2-3 specific bullets>"],
  "concerns": ["<0-3 specific bullets>"]
}

Respond with only valid JSON, no other text.`;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const text = response.text;

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
    score_breakdown: parsed.score_breakdown ? {
      education_score: Number(parsed.score_breakdown.education_score) || 0,
      experience_score: Number(parsed.score_breakdown.experience_score) || 0,
      well_rounded_score: Number(parsed.score_breakdown.well_rounded_score) || 0,
      raw_score: Number(parsed.score_breakdown.raw_score) || 0,
      final_score: Number(parsed.score_breakdown.final_score) || 0,
      caps_applied: Array.isArray(parsed.score_breakdown.caps_applied) ? parsed.score_breakdown.caps_applied : [],
    } : undefined,
    summary: parsed.summary || 'Unable to generate summary.',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
    concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 3) : [],
    generatedAt: new Date().toISOString(),
  };
}
