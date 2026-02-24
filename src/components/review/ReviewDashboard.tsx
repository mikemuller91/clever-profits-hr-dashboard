'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import SwipeCard from './SwipeCard';
import CandidateCard from './CandidateCard';
import { useCandidates } from '@/context/CandidatesContext';

export default function ReviewDashboard() {
  // Shared context for candidates data
  const {
    candidates,
    jobOpenings,
    statuses,
    candidateDetails,
    loading,
    error,
    fetchCandidateDetails,
    updateCandidateStatus,
    ensureLoaded,
  } = useCandidates();

  // UI state
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('New');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating'>('newest');

  // Review state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  // Load data from shared context on mount
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  // Get status IDs
  const notQualifiedStatusId = useMemo(() => {
    return statuses.find(s => s.name === 'Not Qualified')?.id || null;
  }, [statuses]);

  const reviewedStatusId = useMemo(() => {
    return statuses.find(s => s.name === 'Reviewed')?.id || null;
  }, [statuses]);

  // Filter and sort candidates for the queue
  const reviewQueue = useMemo(() => {
    let filtered = candidates;

    // Filter by selected job
    if (selectedJobId !== null) {
      filtered = filtered.filter(c => c.jobId === selectedJobId);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Sort
    if (sortBy === 'newest') {
      filtered = [...filtered].sort((a, b) =>
        new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
      );
    } else if (sortBy === 'oldest') {
      filtered = [...filtered].sort((a, b) =>
        new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime()
      );
    } else if (sortBy === 'rating') {
      filtered = [...filtered].sort((a, b) =>
        (b.rating ?? -1) - (a.rating ?? -1)
      );
    }

    return filtered;
  }, [candidates, selectedJobId, statusFilter, sortBy]);

  // Preload current and next candidates
  useEffect(() => {
    const current = reviewQueue[currentIndex];
    const next = reviewQueue[currentIndex + 1];

    if (current && !candidateDetails[current.id]) {
      fetchCandidateDetails(current.id);
    }
    if (next && !candidateDetails[next.id]) {
      fetchCandidateDetails(next.id);
    }
  }, [currentIndex, reviewQueue, candidateDetails, fetchCandidateDetails]);

  // Update candidate status
  const updateStatus = useCallback(async (candidateId: string, statusId: number, statusName: string) => {
    try {
      const success = await updateCandidateStatus(candidateId, statusId, statusName);
      if (!success) {
        throw new Error('Failed to update status');
      }
      return true;
    } catch (err) {
      console.error('Error updating status:', err);
      setStatusUpdateError(err instanceof Error ? err.message : 'Failed to update status');
      setTimeout(() => setStatusUpdateError(null), 5000);
      return false;
    }
  }, [updateCandidateStatus]);

  // Handle swipe left (Not Qualified)
  const handleSwipeLeft = useCallback(async () => {
    if (isAnimating || !notQualifiedStatusId) return;

    const currentCandidate = reviewQueue[currentIndex];
    if (!currentCandidate) return;

    setIsAnimating(true);

    const success = await updateStatus(currentCandidate.id, notQualifiedStatusId, 'Not Qualified');

    if (success) {
      setReviewedCount(prev => prev + 1);
      // Move to next card after animation
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setIsAnimating(false);
      }, 300);
    } else {
      setIsAnimating(false);
    }
  }, [isAnimating, currentIndex, reviewQueue, notQualifiedStatusId, updateStatus]);

  // Handle swipe right (Reviewed)
  const handleSwipeRight = useCallback(async () => {
    if (isAnimating || !reviewedStatusId) return;

    const currentCandidate = reviewQueue[currentIndex];
    if (!currentCandidate) return;

    setIsAnimating(true);

    const success = await updateStatus(currentCandidate.id, reviewedStatusId, 'Reviewed');

    if (success) {
      setReviewedCount(prev => prev + 1);
      // Move to next card after animation
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setIsAnimating(false);
      }, 300);
    } else {
      setIsAnimating(false);
    }
  }, [isAnimating, currentIndex, reviewQueue, reviewedStatusId, updateStatus]);

  // Reset index when filters change
  useEffect(() => {
    setCurrentIndex(0);
    setReviewedCount(0);
  }, [selectedJobId, statusFilter, sortBy]);

  // Get unique statuses for filter
  const availableStatuses = useMemo(() => {
    const statusSet = new Set(candidates.map(c => c.status).filter(Boolean));
    return ['all', ...Array.from(statusSet).sort()];
  }, [candidates]);

  const selectedJob = jobOpenings.find(j => j.id === selectedJobId);
  const currentCandidate = reviewQueue[currentIndex];
  const remainingCount = reviewQueue.length - currentIndex;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cp-dark mx-auto"></div>
          <p className="mt-4 text-cp-gray">Loading candidates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-lg max-w-md mx-auto text-center">
        <div className="text-red-500 text-5xl mb-4">!</div>
        <h2 className="text-xl font-semibold text-cp-dark mb-2">Error Loading Candidates</h2>
        <p className="text-cp-gray mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Toast */}
      {statusUpdateError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-pulse">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{statusUpdateError}</span>
          <button onClick={() => setStatusUpdateError(null)} className="ml-2 hover:opacity-80">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Job Selection - Compact */}
      <div className="bg-white rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-cp-dark">
            {selectedJob ? `Reviewing: ${selectedJob.title}` : 'Select a Job Opening'}
          </h2>
          {selectedJob && (
            <button
              onClick={() => setSelectedJobId(null)}
              className="text-xs text-cp-blue hover:underline"
            >
              Change
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {jobOpenings.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                selectedJobId === job.id
                  ? 'bg-cp-blue text-white'
                  : 'bg-gray-100 text-cp-dark hover:bg-gray-200'
              }`}
            >
              {job.title} <span className="font-semibold">({job.candidateCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters and Progress */}
      {selectedJobId !== null && (
        <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-cp-gray">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white text-sm"
            >
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-cp-gray">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'rating')}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="rating">Highest Rating</option>
            </select>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-4 text-sm">
            <span className="text-cp-gray">
              Reviewed: <span className="font-semibold text-cp-dark">{reviewedCount}</span>
            </span>
            <span className="text-cp-gray">
              Remaining: <span className="font-semibold text-cp-dark">{remainingCount}</span>
            </span>
          </div>
        </div>
      )}

      {/* Swipe Area */}
      {selectedJobId !== null && (
        <div className="flex flex-col items-center">
          {/* Card Stack */}
          <div className="relative w-full max-w-3xl h-[calc(100vh-280px)] min-h-[500px]">
            {remainingCount === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-cp-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xl font-semibold text-cp-dark mb-2">All Done!</p>
                  <p className="text-cp-gray">
                    You&apos;ve reviewed all {reviewedCount} candidates in this queue.
                  </p>
                  <button
                    onClick={() => {
                      setCurrentIndex(0);
                      setReviewedCount(0);
                    }}
                    className="mt-4 px-4 py-2 bg-cp-blue text-white rounded-lg hover:bg-cp-dark transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            ) : (
              // Render up to 3 cards in the stack
              [...Array(Math.min(3, remainingCount))].map((_, stackIndex) => {
                const queueIndex = currentIndex + stackIndex;
                const candidate = reviewQueue[queueIndex];
                if (!candidate) return null;

                const details = candidateDetails[candidate.id];

                return (
                  <SwipeCard
                    key={candidate.id}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    isActive={!isAnimating}
                    stackIndex={stackIndex}
                  >
                    {details ? (
                      <CandidateCard
                        candidate={details}
                        rating={candidate.rating}
                        ratingConfidence={candidate.ratingConfidence}
                      />
                    ) : (
                      <div className="bg-white rounded-2xl shadow-lg h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cp-dark"></div>
                      </div>
                    )}
                  </SwipeCard>
                );
              })
            )}
          </div>

          {/* Action Buttons */}
          {remainingCount > 0 && (
            <div className="flex items-center justify-center gap-8 mt-6">
              <button
                onClick={handleSwipeLeft}
                disabled={isAnimating || !notQualifiedStatusId}
                className="w-16 h-16 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shadow-md hover:shadow-lg"
                title="Not Qualified (← or N)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="text-center text-sm text-cp-gray">
                <p>Swipe or use keys</p>
                <p className="text-xs mt-1">← / N = Not Qualified | → / Y = Reviewed</p>
              </div>

              <button
                onClick={handleSwipeRight}
                disabled={isAnimating || !reviewedStatusId}
                className="w-16 h-16 bg-green-100 hover:bg-green-200 text-green-600 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shadow-md hover:shadow-lg"
                title="Reviewed (→ or Y)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Missing Status Warning */}
          {(!notQualifiedStatusId || !reviewedStatusId) && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 max-w-md">
              <p className="font-medium">Missing Required Statuses</p>
              <p className="mt-1">
                This feature requires statuses named &quot;Not Qualified&quot; and &quot;Reviewed&quot; in BambooHR.
                {!notQualifiedStatusId && <span className="block">- &quot;Not Qualified&quot; status not found</span>}
                {!reviewedStatusId && <span className="block">- &quot;Reviewed&quot; status not found</span>}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {selectedJobId === null && (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <div className="text-cp-gray">
            <svg className="w-16 h-16 mx-auto mb-4 text-cp-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-medium text-cp-dark mb-2">Select a job opening above</p>
            <p className="text-cp-gray">Click on any job card to start reviewing its applicants</p>
          </div>
        </div>
      )}
    </div>
  );
}
