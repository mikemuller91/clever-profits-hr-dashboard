// Candidate Rating Calculation Utility

// Education level scoring (out of 10)
// Order matters - more specific matches first
const EDUCATION_LEVELS: Array<{ keywords: string[]; score: number; label: string }> = [
  { keywords: ['phd', 'ph.d', 'doctorate', 'doctoral', 'doctor of'], score: 10, label: 'PhD/Doctorate' },
  { keywords: ['ca(sa)', 'ca (sa)', 'chartered accountant', 'cpa', 'c.p.a', 'acca'], score: 9, label: 'Professional (CA/CPA)' },
  { keywords: ['master', 'masters', 'mba', 'm.b.a', 'msc', 'm.sc', 'mcom', 'm.com', 'ma', 'm.a'], score: 8, label: 'Masters' },
  { keywords: ['honour', 'honors', 'hons', 'b.com hons', 'bcom hons', 'postgraduate diploma', 'pgdip'], score: 7, label: 'Honours/Postgrad Diploma' },
  { keywords: ['bachelor', 'bachelors', 'bcom', 'b.com', 'bsc', 'b.sc', 'ba', 'b.a', 'bba', 'b.b.a', 'llb', 'l.l.b', 'btech', 'b.tech', 'degree', 'undergraduate'], score: 6, label: 'Bachelors Degree' },
  { keywords: ['associate', 'associates'], score: 5, label: 'Associates' },
  { keywords: ['national diploma', 'n.dip', 'ndip', 'diploma'], score: 4, label: 'Diploma' },
  { keywords: ['certificate', 'cert', 'certification'], score: 3, label: 'Certificate' },
  { keywords: ['matric', 'matriculation', 'high school', 'secondary', 'ged', 'grade 12', 'nsc', 'national senior certificate'], score: 2, label: 'Matric/High School' },
];

// Top 5 South African universities for accounting (eligible for bonus points)
const TOP_SA_ACCOUNTING_UNIVERSITIES = [
  { keywords: ['university of cape town', 'uct'], name: 'University of Cape Town' },
  { keywords: ['stellenbosch', 'maties', 'us '], name: 'Stellenbosch University' },
  { keywords: ['university of pretoria', 'tuks', ' up '], name: 'University of Pretoria' },
  { keywords: ['witwatersrand', 'wits'], name: 'University of the Witwatersrand' },
  { keywords: ['university of johannesburg', ' uj '], name: 'University of Johannesburg' },
];

// Experience scoring (years to score)
function scoreExperience(years: number): number {
  if (years >= 15) return 10;
  if (years >= 10) return 9;
  if (years >= 7) return 8;
  if (years >= 5) return 7;
  if (years >= 3) return 5;
  if (years >= 2) return 4;
  if (years >= 1) return 3;
  return 1;
}

// Extract education level from text
function extractEducationLevel(text: string): { level: string; score: number } | null {
  const lowerText = text.toLowerCase();

  for (const eduLevel of EDUCATION_LEVELS) {
    for (const keyword of eduLevel.keywords) {
      if (lowerText.includes(keyword)) {
        return { level: eduLevel.label, score: eduLevel.score };
      }
    }
  }
  return null;
}

// Extract institution from text
function extractInstitution(text: string, isDirectQuestion: boolean = false): { name: string; isTopSAAccounting: boolean } | null {
  const lowerText = text.toLowerCase().trim();

  if (!lowerText || lowerText.length < 2) {
    return null;
  }

  for (const uni of TOP_SA_ACCOUNTING_UNIVERSITIES) {
    for (const keyword of uni.keywords) {
      if (lowerText.includes(keyword.trim())) {
        return { name: uni.name, isTopSAAccounting: true };
      }
    }
  }

  if (isDirectQuestion) {
    return { name: text.trim(), isTopSAAccounting: false };
  }

  const uniMatch = text.match(/(?:university|college|institute|school)\s+of\s+[\w\s]+|[\w\s]+(?:university|college|institute|technikon)/i);
  if (uniMatch) {
    return { name: uniMatch[0].trim(), isTopSAAccounting: false };
  }

  return null;
}

// Extract years of experience from text
function extractYearsExperience(text: string): number | null {
  const trimmedText = text.trim();

  if (/^\d+$/.test(trimmedText)) {
    return parseInt(trimmedText, 10);
  }

  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)/i,
    /(\d+)\s*-\s*\d+\s*(?:years?|yrs?)/i,
    /(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s*(?:years?|yrs?)?/i,
    /(\d+)\+?\s*(?:completed|full)?\s*(?:years?|yrs?)?/i,
  ];

  const wordToNum: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'fifteen': 15, 'twenty': 20,
  };

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = match[1];
      if (wordToNum[val.toLowerCase()]) {
        return wordToNum[val.toLowerCase()];
      }
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

// Analyze questions and answers for rating data
function analyzeQuestionsAndAnswers(qas: Array<{ question?: { label?: string }; answer?: { label?: string } }>) {
  const results = {
    education: null as { level: string; score: number } | null,
    institution: null as { name: string; isTopSAAccounting: boolean } | null,
    experience: null as number | null,
    fieldsUsed: [] as string[],
  };

  for (const qa of qas) {
    const question = qa.question?.label?.toLowerCase() || '';
    const answer = qa.answer?.label || '';

    if (!answer) continue;

    // Check for education-related questions
    if (question.includes('education') || question.includes('qualification') ||
        question.includes('degree') || question.includes('study') || question.includes('level')) {
      const edu = extractEducationLevel(answer);
      if (edu && (!results.education || edu.score > results.education.score)) {
        results.education = edu;
        results.fieldsUsed.push('questionsAndAnswers:education');
      }

      if (!results.institution) {
        const inst = extractInstitution(answer, false);
        if (inst) {
          results.institution = inst;
          results.fieldsUsed.push('questionsAndAnswers:institution');
        }
      }
    }

    // Check for institution-related questions
    if (question.includes('university') || question.includes('college') ||
        question.includes('institution') || question.includes('school') ||
        question.includes('where') || question.includes('which')) {
      const inst = extractInstitution(answer, true);
      if (inst) {
        results.institution = inst;
        results.fieldsUsed.push('questionsAndAnswers:institution');
      }
    }

    // Check for experience-related questions
    if (question.includes('experience') || question.includes('years') ||
        question.includes('work history') || question.includes('background')) {
      const years = extractYearsExperience(answer);
      if (years !== null) {
        results.experience = years;
        results.fieldsUsed.push('questionsAndAnswers:experience');
      }
    }
  }

  return results;
}

export interface RatingResult {
  overall: number;
  educationScore: number;
  experienceScore: number;
  educationLevel: string | null;
  institution: string | null;
  yearsExperience: number | null;
  confidence: 'high' | 'medium' | 'low';
  dataSource: string[];
}

// Calculate rating from application data
export function calculateRating(questionsAndAnswers: Array<{ question?: { label?: string }; answer?: { label?: string } }>): RatingResult {
  const qaAnalysis = analyzeQuestionsAndAnswers(questionsAndAnswers || []);

  // Calculate scores
  let educationScore = qaAnalysis.education?.score || 0;

  // Only add institution bonus for top 5 SA accounting universities (+1 point)
  if (qaAnalysis.institution?.isTopSAAccounting) {
    educationScore = Math.min(10, educationScore + 1);
  }

  const experienceScore = qaAnalysis.experience !== null
    ? scoreExperience(qaAnalysis.experience)
    : 0;

  // Calculate overall score (weighted average)
  const hasEducation = qaAnalysis.education !== null;
  const hasExperience = qaAnalysis.experience !== null;

  let overall = 0;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (hasEducation && hasExperience) {
    overall = Math.round((educationScore * 0.5 + experienceScore * 0.5) * 10) / 10;
    confidence = 'high';
  } else if (hasEducation || hasExperience) {
    overall = hasEducation ? educationScore : experienceScore;
    confidence = 'medium';
  } else {
    overall = 0;
    confidence = 'low';
  }

  return {
    overall,
    educationScore,
    experienceScore,
    educationLevel: qaAnalysis.education?.level || null,
    institution: qaAnalysis.institution?.name || null,
    yearsExperience: qaAnalysis.experience,
    confidence,
    dataSource: [...new Set(qaAnalysis.fieldsUsed)],
  };
}
