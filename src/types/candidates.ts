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
  resumeFileId: number | null;
  coverLetterFileId: number | null;
  questionsAndAnswers: { question: string; answer: string }[];
  hiringLead: { name: string; employeeId: number } | null;
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
