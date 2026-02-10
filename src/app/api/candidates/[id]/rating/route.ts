import { NextResponse } from 'next/server';
import { CandidateRating } from '@/types/candidates';

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

// Education level scoring (out of 10)
// Order matters - more specific matches first
const EDUCATION_LEVELS: Array<{ keywords: string[]; score: number; label: string }> = [
  { keywords: ['phd', 'ph.d', 'doctorate', 'doctoral', 'doctor of'], score: 10, label: 'PhD/Doctorate' },
  { keywords: ['master', 'masters', 'mba', 'm.b.a', 'msc', 'm.sc', 'mcom', 'm.com', 'ma', 'm.a'], score: 8, label: 'Masters' },
  { keywords: ['ca(sa)', 'ca (sa)', 'chartered accountant', 'cpa', 'c.p.a', 'acca'], score: 9, label: 'Professional (CA/CPA)' },
  { keywords: ['honour', 'honors', 'hons', 'b.com hons', 'bcom hons', 'postgraduate diploma', 'pgdip'], score: 7, label: 'Honours/Postgrad Diploma' },
  { keywords: ['bachelor', 'bachelors', 'bcom', 'b.com', 'bsc', 'b.sc', 'ba', 'b.a', 'bba', 'b.b.a', 'llb', 'l.l.b', 'btech', 'b.tech', 'degree', 'undergraduate'], score: 6, label: 'Bachelors Degree' },
  { keywords: ['associate', 'associates'], score: 5, label: 'Associates' },
  { keywords: ['national diploma', 'n.dip', 'ndip', 'diploma'], score: 4, label: 'Diploma' },
  { keywords: ['certificate', 'cert', 'certification'], score: 3, label: 'Certificate' },
  { keywords: ['matric', 'matriculation', 'high school', 'secondary', 'ged', 'grade 12', 'nsc', 'national senior certificate'], score: 2, label: 'Matric/High School' },
];

// Institution tier scoring (bonus points)
const PRESTIGIOUS_INSTITUTIONS = [
  'harvard', 'stanford', 'mit', 'yale', 'princeton', 'columbia', 'oxford',
  'cambridge', 'berkeley', 'caltech', 'chicago', 'upenn', 'cornell', 'duke',
  'northwestern', 'johns hopkins', 'ucla', 'nyu', 'michigan', 'carnegie mellon',
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
function extractInstitution(text: string, isDirectQuestion: boolean = false): { name: string; isPrestigious: boolean } | null {
  const lowerText = text.toLowerCase().trim();

  // If there's no meaningful text, return null
  if (!lowerText || lowerText.length < 2) {
    return null;
  }

  // Check for prestigious institutions first
  for (const institution of PRESTIGIOUS_INSTITUTIONS) {
    if (lowerText.includes(institution)) {
      return { name: text.trim(), isPrestigious: true };
    }
  }

  // If this is a direct answer to an institution question, use the whole answer
  if (isDirectQuestion) {
    return { name: text.trim(), isPrestigious: false };
  }

  // Try to extract any university/college name from longer text
  const uniMatch = text.match(/(?:university|college|institute|school)\s+of\s+[\w\s]+|[\w\s]+(?:university|college|institute|technikon|tut|unisa|uct|wits|ukzn|up|ufs|uj|nmu|cput)/i);
  if (uniMatch) {
    return { name: uniMatch[0].trim(), isPrestigious: false };
  }

  return null;
}

// Extract years of experience from text
function extractYearsExperience(text: string): number | null {
  const trimmedText = text.trim();

  // First, check if the answer is just a number (e.g., "5" or "10")
  if (/^\d+$/.test(trimmedText)) {
    return parseInt(trimmedText, 10);
  }

  // Match patterns like "5 years", "5+ years", "5-7 years", "five years"
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
    institution: null as { name: string; isPrestigious: boolean } | null,
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

      // Also try to extract institution from education answers (but not as direct question)
      if (!results.institution) {
        const inst = extractInstitution(answer, false);
        if (inst) {
          results.institution = inst;
          results.fieldsUsed.push('questionsAndAnswers:institution');
        }
      }
    }

    // Check for institution-related questions (direct question about where they studied)
    if (question.includes('university') || question.includes('college') ||
        question.includes('institution') || question.includes('school') ||
        question.includes('where') || question.includes('which')) {
      const inst = extractInstitution(answer, true); // Pass true for direct institution question
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    return NextResponse.json(
      { error: 'BambooHR credentials not configured.' },
      { status: 500 }
    );
  }

  try {
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;
    const url = `${baseUrl}/applicant_tracking/applications/${id}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `ATS API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const app = await response.json();

    // Analyze all available data
    const qaAnalysis = analyzeQuestionsAndAnswers(app.questionsAndAnswers || []);

    // Also check resume/cover letter text if available (BambooHR might include parsed text)
    const resumeText = app.resumeText || app.parsedResume || '';
    const coverLetterText = app.coverLetterText || '';

    // Extract from resume if Q&A didn't provide data
    if (!qaAnalysis.education && resumeText) {
      const edu = extractEducationLevel(resumeText);
      if (edu) {
        qaAnalysis.education = edu;
        qaAnalysis.fieldsUsed.push('resumeText:education');
      }
    }

    if (!qaAnalysis.institution && resumeText) {
      const inst = extractInstitution(resumeText);
      if (inst) {
        qaAnalysis.institution = inst;
        qaAnalysis.fieldsUsed.push('resumeText:institution');
      }
    }

    if (qaAnalysis.experience === null && resumeText) {
      const years = extractYearsExperience(resumeText);
      if (years !== null) {
        qaAnalysis.experience = years;
        qaAnalysis.fieldsUsed.push('resumeText:experience');
      }
    }

    // Calculate scores
    let educationScore = qaAnalysis.education?.score || 0;

    // Add institution bonus (up to 2 points)
    if (qaAnalysis.institution?.isPrestigious) {
      educationScore = Math.min(10, educationScore + 2);
    } else if (qaAnalysis.institution) {
      educationScore = Math.min(10, educationScore + 1);
    }

    const experienceScore = qaAnalysis.experience !== null
      ? scoreExperience(qaAnalysis.experience)
      : 0;

    // Calculate overall score (weighted average)
    // Education: 50%, Experience: 50%
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

    const rating: CandidateRating = {
      overall,
      breakdown: {
        education: {
          score: educationScore,
          level: qaAnalysis.education?.level || null,
          institution: qaAnalysis.institution?.name || null,
        },
        experience: {
          score: experienceScore,
          years: qaAnalysis.experience,
        },
      },
      confidence,
      dataSource: [...new Set(qaAnalysis.fieldsUsed)],
    };

    return NextResponse.json(rating);
  } catch (error) {
    console.error('Error calculating candidate rating:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate rating' },
      { status: 500 }
    );
  }
}
