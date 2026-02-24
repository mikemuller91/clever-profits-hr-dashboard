'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { Candidate, CandidateDetail, JobOpening, CandidateStatus, CandidateRating, AIEvaluation } from '@/types/candidates';

interface CandidatesContextType {
  // Data
  candidates: Candidate[];
  jobOpenings: JobOpening[];
  statuses: CandidateStatus[];
  candidateDetails: Record<string, CandidateDetail>;
  candidateRatings: Record<string, CandidateRating>;
  aiEvaluations: Record<string, AIEvaluation>;

  // State
  loading: boolean;
  error: string | null;
  initialized: boolean;
  aiEvaluationLoading: Record<string, boolean>;

  // Actions
  setCandidates: React.Dispatch<React.SetStateAction<Candidate[]>>;
  fetchCandidateDetails: (candidateId: string) => Promise<CandidateDetail | null>;
  fetchAIEvaluation: (candidateId: string) => Promise<AIEvaluation | null>;
  updateCandidateStatus: (candidateId: string, statusId: number, statusName: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  ensureLoaded: () => Promise<void>;
}

const CandidatesContext = createContext<CandidatesContextType | null>(null);

export function CandidatesProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [statuses, setStatuses] = useState<CandidateStatus[]>([]);
  const [candidateDetails, setCandidateDetails] = useState<Record<string, CandidateDetail>>({});
  const [candidateRatings, setCandidateRatings] = useState<Record<string, CandidateRating>>({});
  const [aiEvaluations, setAiEvaluations] = useState<Record<string, AIEvaluation>>({});
  const [aiEvaluationLoading, setAiEvaluationLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const loadingRef = useRef(false);
  const detailsLoadingRef = useRef<Set<string>>(new Set());
  const aiEvalLoadingRef = useRef<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    // Prevent duplicate calls
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      // Fetch candidates and statuses first (critical)
      const [candidatesRes, statusesRes] = await Promise.all([
        fetch('/api/candidates'),
        fetch('/api/candidates/statuses'),
      ]);

      const candidatesData = await candidatesRes.json();
      const statusesData = await statusesRes.json();

      if (!candidatesRes.ok) {
        throw new Error(candidatesData.error || 'Failed to fetch candidates');
      }

      setCandidates(candidatesData.candidates || []);
      setJobOpenings(candidatesData.jobOpenings || []);
      setStatuses(statusesData.statuses || []);
      setInitialized(true);

      // Fetch cached AI evaluations in background (non-blocking)
      fetch('/api/candidates/ai-evaluations/batch')
        .then(res => res.json())
        .then(data => {
          if (data.evaluations) {
            setAiEvaluations(data.evaluations);
            console.log(`[CandidatesContext] Loaded ${Object.keys(data.evaluations).length} cached AI evaluations`);
          }
        })
        .catch(err => {
          console.error('[CandidatesContext] Failed to load cached AI evaluations:', err);
        });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Lazy load - call this to ensure data is loaded
  const ensureLoaded = useCallback(async () => {
    if (!initialized && !loadingRef.current) {
      await loadData();
    }
  }, [initialized, loadData]);

  // Fetch candidate details (with caching and deduplication)
  const fetchCandidateDetails = useCallback(async (candidateId: string): Promise<CandidateDetail | null> => {
    // Return cached if available
    if (candidateDetails[candidateId]) {
      return candidateDetails[candidateId];
    }

    // Prevent duplicate requests
    if (detailsLoadingRef.current.has(candidateId)) {
      return null;
    }

    detailsLoadingRef.current.add(candidateId);

    try {
      // Fetch only the details - rating is already in the candidates list
      const detailsResponse = await fetch(`/api/candidates/${candidateId}`);

      if (!detailsResponse.ok) {
        const data = await detailsResponse.json();
        throw new Error(data.error || 'Failed to fetch candidate details');
      }

      const detailsData = await detailsResponse.json();
      setCandidateDetails(prev => ({ ...prev, [candidateId]: detailsData }));

      return detailsData;
    } catch (err) {
      console.error('Error fetching candidate details:', err);
      return null;
    } finally {
      detailsLoadingRef.current.delete(candidateId);
    }
  }, [candidateDetails]);

  // Fetch AI evaluation (with caching and deduplication)
  const fetchAIEvaluation = useCallback(async (candidateId: string): Promise<AIEvaluation | null> => {
    // Return cached if available
    if (aiEvaluations[candidateId]) {
      return aiEvaluations[candidateId];
    }

    // Prevent duplicate requests
    if (aiEvalLoadingRef.current.has(candidateId)) {
      return null;
    }

    aiEvalLoadingRef.current.add(candidateId);
    setAiEvaluationLoading(prev => ({ ...prev, [candidateId]: true }));

    try {
      const response = await fetch(`/api/candidates/${candidateId}/ai-evaluation`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch AI evaluation');
      }

      const evaluation = await response.json();
      setAiEvaluations(prev => ({ ...prev, [candidateId]: evaluation }));

      return evaluation;
    } catch (err) {
      console.error('Error fetching AI evaluation:', err);
      return null;
    } finally {
      aiEvalLoadingRef.current.delete(candidateId);
      setAiEvaluationLoading(prev => ({ ...prev, [candidateId]: false }));
    }
  }, [aiEvaluations]);

  // Update candidate status
  const updateCandidateStatus = useCallback(async (
    candidateId: string,
    statusId: number,
    statusName: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      // Update candidates list
      setCandidates(prev =>
        prev.map(c =>
          c.id === candidateId
            ? { ...c, status: statusName, statusId }
            : c
        )
      );

      // Update cached details if present
      if (candidateDetails[candidateId]) {
        setCandidateDetails(prev => ({
          ...prev,
          [candidateId]: { ...prev[candidateId], status: statusName, statusId },
        }));
      }

      return true;
    } catch (err) {
      console.error('Error updating status:', err);
      return false;
    }
  }, [candidateDetails]);

  const value: CandidatesContextType = {
    candidates,
    jobOpenings,
    statuses,
    candidateDetails,
    candidateRatings,
    aiEvaluations,
    loading,
    error,
    initialized,
    aiEvaluationLoading,
    setCandidates,
    fetchCandidateDetails,
    fetchAIEvaluation,
    updateCandidateStatus,
    refresh: loadData,
    ensureLoaded,
  };

  return (
    <CandidatesContext.Provider value={value}>
      {children}
    </CandidatesContext.Provider>
  );
}

export function useCandidates() {
  const context = useContext(CandidatesContext);
  if (!context) {
    throw new Error('useCandidates must be used within a CandidatesProvider');
  }
  return context;
}
