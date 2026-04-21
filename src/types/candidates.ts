export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  jobId: number | null;
  jobTitle: string;
  status: string;
  statusId: number | null;
  appliedDate: string;
  source: string;
  answers: { question: string; answer: string }[];
  rating: number | null; // AI rating out of 10
  ratingConfidence: 'high' | 'medium' | 'low' | null;
  institution: string | null; // University/institution from application
}

export interface CandidateDetail {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  jobId: number | null;
  jobTitle: string;
  status: string;
  statusId: number | null;
  statusChangedDate: string;
  appliedDate: string;
  source: string;
  linkedinUrl: string;
  websiteUrl: string;
  address: {
    line1: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  } | null;
  availableStartDate: string;
  desiredSalary: string;
  referredBy: string;
  // Local file storage
  resumeFilePath?: string | null;
  hasResume?: boolean;
  coverLetterPath?: string | null;
  // BambooHR file IDs (legacy)
  resumeFileId?: number | null;
  coverLetterFileId?: number | null;
  // AI Evaluation
  aiScore?: number | null;
  aiSummary?: string | null;
  aiStrengths?: string[];
  aiConcerns?: string[];
  aiEvaluatedAt?: string | null;
  questionsAndAnswers: { question: string; answer: string }[];
  notes?: { id: number; note: string; author: string; createdAt: string }[];
  hiringLead: { name: string; employeeId: number } | null;
  createdAt?: string;
  updatedAt?: string;
  department?: string;
  location?: string;
}

export interface JobOpening {
  id: number;
  title: string;
  candidateCount: number;
}

export interface CandidateStatus {
  id: number;
  name: string;
}

export interface CandidateRating {
  overall: number; // 0-10
  breakdown: {
    education: {
      score: number; // 0-10
      level: string | null;
      institution: string | null;
    };
    experience: {
      score: number; // 0-10
      years: number | null;
    };
  };
  confidence: 'high' | 'medium' | 'low'; // Based on how much data was available
  dataSource: string[]; // What fields were used to calculate
}

export interface AIEvaluation {
  score: number; // 1-10, relative to the job
  summary: string; // 2-3 sentence summary
  strengths: string[]; // Key strengths
  concerns: string[]; // Concerns or gaps
  generatedAt: string; // ISO timestamp
}

export interface TalentPool {
  id: string;
  name: string;
  candidateIds: string[];
  createdAt: string;
}

export interface TalentPoolWithCandidates extends TalentPool {
  candidates: Candidate[];
}
