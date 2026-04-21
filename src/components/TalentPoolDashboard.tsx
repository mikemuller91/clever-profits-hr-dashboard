'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TalentPool, Candidate, CandidateDetail, AIEvaluation } from '@/types/candidates';
import { useCandidates } from '@/context/CandidatesContext';
import CandidateKanbanCard from './CandidateKanbanCard';

// Define status columns in order
const STATUS_COLUMNS = [
  'New',
  'Reviewed',
  'Phone Screening',
  'Interview',
  'Assessment',
  'Reference Check',
  'Offer Extended',
  'Hired',
  'Not Qualified',
  'Rejected',
  'Withdrawn',
];

export default function TalentPoolDashboard() {
  const {
    candidates,
    aiEvaluations,
    candidateDetails,
    aiEvaluationLoading,
    ensureLoaded,
    loading: candidatesLoading,
    fetchCandidateDetails: contextFetchDetails,
    fetchAIEvaluation,
  } = useCandidates();

  const [pools, setPools] = useState<TalentPool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState('');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [creatingPool, setCreatingPool] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Detail modal state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedQA, setExpandedQA] = useState<number | null>(null);

  // CV popup state
  const [cvPopup, setCvPopup] = useState<{ candidateId: string; fileId?: number; candidateName: string } | null>(null);

  // Load pools and candidates
  useEffect(() => {
    async function load() {
      await ensureLoaded();
      try {
        const res = await fetch('/api/talent-pools');
        const data = await res.json();
        if (data.pools) {
          setPools(data.pools);
          if (!selectedPoolId && data.pools.length > 0) {
            setSelectedPoolId(data.pools[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load talent pools');
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close add dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedPool = pools.find(p => p.id === selectedPoolId) || null;

  // Candidates in the selected pool
  const poolCandidates: Candidate[] = selectedPool
    ? candidates.filter(c => selectedPool.candidateIds.includes(c.id))
    : [];

  // Filtered by search
  const filteredPoolCandidates = poolCandidates.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.jobTitle.toLowerCase().includes(term) ||
      c.status.toLowerCase().includes(term)
    );
  });

  // Group candidates by status for Kanban columns
  const candidatesByStatus = useMemo(() => {
    const grouped: Record<string, Candidate[]> = {};

    // Initialize all columns
    STATUS_COLUMNS.forEach(status => {
      grouped[status] = [];
    });

    // Group filtered candidates
    filteredPoolCandidates.forEach(candidate => {
      const status = candidate.status || 'New';
      // Find matching column (case-insensitive)
      const matchedColumn = STATUS_COLUMNS.find(
        col => col.toLowerCase() === status.toLowerCase()
      );
      if (matchedColumn) {
        grouped[matchedColumn].push(candidate);
      } else {
        // Put unknown statuses in 'New'
        grouped['New'].push(candidate);
      }
    });

    return grouped;
  }, [filteredPoolCandidates]);

  // Get columns that have candidates (for cleaner UI)
  const activeColumns = useMemo(() => {
    return STATUS_COLUMNS.filter(status => candidatesByStatus[status].length > 0);
  }, [candidatesByStatus]);

  // Candidates available to add (not already in pool)
  const availableCandidates = candidates.filter(c => {
    if (!selectedPool) return false;
    if (selectedPool.candidateIds.includes(c.id)) return false;
    if (!addSearchTerm) return false;
    const term = addSearchTerm.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.jobTitle.toLowerCase().includes(term)
    );
  }).slice(0, 20);

  const addCandidate = useCallback(async (candidateId: string) => {
    if (!selectedPoolId) return;
    setAddingCandidate(true);
    try {
      const res = await fetch('/api/talent-pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: selectedPoolId, candidateId, action: 'add' }),
      });
      const data = await res.json();
      if (res.ok && data.pool) {
        setPools(prev => prev.map(p => p.id === selectedPoolId ? data.pool : p));
        setAddSearchTerm('');
        setShowAddDropdown(false);
      }
    } catch (err) {
      console.error('Error adding candidate:', err);
    } finally {
      setAddingCandidate(false);
    }
  }, [selectedPoolId]);

  const createPool = useCallback(async () => {
    if (!newPoolName.trim()) return;
    setCreatingPool(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/talent-pools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPoolName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create pool');
        return;
      }
      if (data.pools) {
        setPools(data.pools);
      }
      setSelectedPoolId(data.pool.id);
      setNewPoolName('');
      setShowCreatePool(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create pool');
    } finally {
      setCreatingPool(false);
    }
  }, [newPoolName]);

  const removeCandidate = useCallback(async (candidateId: string) => {
    if (!selectedPoolId) return;
    setRemovingId(candidateId);
    try {
      const res = await fetch('/api/talent-pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: selectedPoolId, candidateId, action: 'remove' }),
      });
      const data = await res.json();
      if (res.ok && data.pool) {
        setPools(prev => prev.map(p => p.id === selectedPoolId ? data.pool : p));
      }
    } catch (err) {
      console.error('Error removing candidate:', err);
    } finally {
      setRemovingId(null);
    }
  }, [selectedPoolId]);

  // Open candidate detail modal
  const openCandidateDetail = useCallback(async (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setLoadingDetails(true);
    setExpandedQA(null);

    try {
      // Fetch details if not cached
      if (!candidateDetails[candidateId]) {
        await contextFetchDetails(candidateId);
      }
      // Fetch AI evaluation if not cached
      if (!aiEvaluations[candidateId] && !aiEvaluationLoading[candidateId]) {
        fetchAIEvaluation(candidateId);
      }
    } catch (err) {
      console.error('Error fetching candidate details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [candidateDetails, aiEvaluations, aiEvaluationLoading, contextFetchDetails, fetchAIEvaluation]);

  const closeCandidateDetail = () => {
    setSelectedCandidateId(null);
    setExpandedQA(null);
  };

  const openCvPopup = (candidateId: string, candidateName: string, fileId?: number) => {
    setCvPopup({ candidateId, fileId, candidateName });
  };

  const closeCvPopup = () => {
    setCvPopup(null);
  };

  function getAIScoreColor(score: number): string {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (score >= 6) return 'bg-blue-50 text-blue-700 ring-blue-200';
    if (score >= 4) return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  function getStatusColor(status: string): string {
    const s = status.toLowerCase();
    if (s === 'new') return 'bg-blue-500';
    if (s.includes('review') || s.includes('screen')) return 'bg-purple-500';
    if (s.includes('interview')) return 'bg-amber-500';
    if (s.includes('assessment')) return 'bg-cyan-500';
    if (s.includes('reference')) return 'bg-indigo-500';
    if (s.includes('offer')) return 'bg-emerald-500';
    if (s.includes('hired')) return 'bg-green-500';
    if (s.includes('reject') || s.includes('not qualified') || s.includes('withdraw')) return 'bg-red-500';
    return 'bg-gray-500';
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Get the selected candidate and their details for modal
  const selectedCandidate = selectedCandidateId
    ? candidates.find(c => c.id === selectedCandidateId)
    : null;
  const selectedCandidateDetails = selectedCandidateId
    ? candidateDetails[selectedCandidateId]
    : null;
  const selectedAIEval = selectedCandidateId
    ? aiEvaluations[selectedCandidateId]
    : null;

  if (loading || candidatesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cp-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">Error loading talent pools</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-cp-dark">Talent Pool</h1>
          <p className="text-cp-gray text-sm mt-1">
            Manage candidate pools for future opportunities
          </p>
        </div>
      </div>

      {/* Pool Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {pools.map(pool => (
          <button
            key={pool.id}
            onClick={() => setSelectedPoolId(pool.id)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedPoolId === pool.id
                ? 'bg-cp-blue text-white shadow-sm'
                : 'bg-white text-cp-gray hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {pool.name}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              selectedPoolId === pool.id
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-cp-gray'
            }`}>
              {pool.candidateIds.length}
            </span>
          </button>
        ))}

        {/* Create Pool Button / Form */}
        {showCreatePool ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Pool name..."
              value={newPoolName}
              onChange={(e) => { setNewPoolName(e.target.value); setCreateError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') createPool(); if (e.key === 'Escape') { setShowCreatePool(false); setNewPoolName(''); setCreateError(null); } }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cp-blue/30 focus:border-cp-blue w-48"
              autoFocus
              disabled={creatingPool}
            />
            <button
              onClick={createPool}
              disabled={creatingPool || !newPoolName.trim()}
              className="px-3 py-2 bg-cp-blue text-white rounded-lg text-sm font-medium hover:bg-cp-blue/90 transition-colors disabled:opacity-50"
            >
              {creatingPool ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreatePool(false); setNewPoolName(''); setCreateError(null); }}
              className="px-3 py-2 text-cp-gray hover:text-cp-dark text-sm transition-colors"
            >
              Cancel
            </button>
            {createError && (
              <span className="text-red-500 text-xs">{createError}</span>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowCreatePool(true)}
            className="px-4 py-2 rounded-lg font-medium text-sm border border-dashed border-gray-300 text-cp-gray hover:border-cp-blue hover:text-cp-blue transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Pool
          </button>
        )}
      </div>

      {selectedPool && (
        <>
          {/* Search & Add Controls */}
          <div className="flex items-center gap-4 mb-4">
            {/* Search within pool */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search in this pool..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cp-blue/30 focus:border-cp-blue"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Add candidate */}
            <div className="relative" ref={addDropdownRef}>
              <button
                onClick={() => setShowAddDropdown(!showAddDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-cp-blue text-white rounded-lg text-sm font-medium hover:bg-cp-blue/90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Candidate
              </button>

              {showAddDropdown && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder="Search candidates by name, email, or job title..."
                      value={addSearchTerm}
                      onChange={(e) => setAddSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cp-blue/30 focus:border-cp-blue"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {addSearchTerm.length === 0 ? (
                      <p className="p-4 text-sm text-cp-gray text-center">
                        Type to search candidates...
                      </p>
                    ) : availableCandidates.length === 0 ? (
                      <p className="p-4 text-sm text-cp-gray text-center">
                        No matching candidates found
                      </p>
                    ) : (
                      availableCandidates.map(c => (
                        <button
                          key={c.id}
                          onClick={() => addCandidate(c.id)}
                          disabled={addingCandidate}
                          className="w-full text-left px-4 py-3 hover:bg-cp-light/50 transition-colors border-b border-gray-50 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-cp-cyan text-white flex items-center justify-center font-medium text-xs">
                              {c.firstName?.[0] || '?'}{c.lastName?.[0] || ''}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-cp-dark truncate">{c.displayName}</p>
                              <p className="text-xs text-cp-gray truncate">{c.jobTitle} &middot; {c.status}</p>
                            </div>
                            {aiEvaluations[c.id] && (
                              <div className={`w-7 h-7 rounded-md ring-1 flex items-center justify-center text-xs font-bold ${getAIScoreColor(aiEvaluations[c.id].score)}`}>
                                {aiEvaluations[c.id].score}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kanban Board */}
          <div className="bg-gray-50 rounded-xl p-4 overflow-hidden">
            {filteredPoolCandidates.length === 0 ? (
              <div className="py-12 text-center text-cp-gray">
                {poolCandidates.length === 0
                  ? 'No candidates in this pool yet. Click "Add Candidate" to get started.'
                  : 'No candidates match your search.'}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
                {activeColumns.map(status => (
                  <div
                    key={status}
                    className="flex-shrink-0 w-72 bg-white rounded-lg border border-gray-200 flex flex-col"
                  >
                    {/* Column Header */}
                    <div className="p-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
                        <h3 className="font-medium text-sm text-cp-dark">{status}</h3>
                        <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-gray-100 text-cp-gray font-medium">
                          {candidatesByStatus[status].length}
                        </span>
                      </div>
                    </div>

                    {/* Column Content */}
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px]">
                      {candidatesByStatus[status].map(candidate => (
                        <CandidateKanbanCard
                          key={candidate.id}
                          candidate={candidate}
                          aiEvaluation={aiEvaluations[candidate.id]}
                          onClick={() => openCandidateDetail(candidate.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pool summary */}
          <div className="mt-4 text-sm text-cp-gray">
            {filteredPoolCandidates.length} candidate{filteredPoolCandidates.length !== 1 ? 's' : ''} in {selectedPool.name}
          </div>
        </>
      )}

      {/* Candidate Detail Modal */}
      {selectedCandidateId && selectedCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-cp-cyan text-white flex items-center justify-center font-medium text-lg">
                  {selectedCandidate.firstName?.[0] || '?'}{selectedCandidate.lastName?.[0] || ''}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-cp-dark">{selectedCandidate.displayName}</h3>
                  <p className="text-sm text-cp-gray">{selectedCandidate.jobTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => removeCandidate(selectedCandidateId)}
                  disabled={removingId === selectedCandidateId}
                  className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {removingId === selectedCandidateId ? 'Removing...' : 'Remove from Pool'}
                </button>
                <button
                  onClick={closeCandidateDetail}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-cp-gray"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cp-blue"></div>
                </div>
              ) : (
                <>
                  {/* AI Evaluation */}
                  {selectedAIEval ? (
                    <div className="bg-gradient-to-r from-cp-blue/10 to-cp-cyan/10 rounded-lg p-4 border border-cp-blue/20">
                      <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ring-2 ${getAIScoreColor(selectedAIEval.score)}`}>
                          <span className="text-xl font-bold">{selectedAIEval.score}</span>
                          <span className="text-[9px] opacity-70">/10</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-cp-dark flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-cp-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            AI Evaluation
                          </h4>
                          <p className="text-sm text-cp-dark leading-relaxed">{selectedAIEval.summary}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {selectedAIEval.strengths.map((strength, i) => (
                              <span key={`s-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {strength}
                              </span>
                            ))}
                            {selectedAIEval.concerns.map((concern, i) => (
                              <span key={`c-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {concern}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : aiEvaluationLoading[selectedCandidateId] ? (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-cp-blue border-t-transparent"></div>
                      <span className="text-sm text-cp-gray">Generating AI evaluation...</span>
                    </div>
                  ) : null}

                  {/* Contact Info */}
                  {selectedCandidateDetails && (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedCandidate.email && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-cp-gray uppercase tracking-wide">Email</p>
                          <a href={`mailto:${selectedCandidate.email}`} className="text-sm font-medium text-cp-blue hover:underline">{selectedCandidate.email}</a>
                        </div>
                      )}
                      {selectedCandidateDetails.phoneNumber && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-cp-gray uppercase tracking-wide">Phone</p>
                          <a href={`tel:${selectedCandidateDetails.phoneNumber}`} className="text-sm font-medium text-cp-dark">{selectedCandidateDetails.phoneNumber}</a>
                        </div>
                      )}
                      {selectedCandidateDetails.linkedinUrl && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-cp-gray uppercase tracking-wide">LinkedIn</p>
                          <a href={selectedCandidateDetails.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-cp-blue hover:underline">View Profile</a>
                        </div>
                      )}
                      {selectedCandidateDetails.availableStartDate && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-cp-gray uppercase tracking-wide">Available Start</p>
                          <p className="text-sm font-medium text-cp-dark">{formatDate(selectedCandidateDetails.availableStartDate)}</p>
                        </div>
                      )}
                      {selectedCandidateDetails.desiredSalary && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-cp-gray uppercase tracking-wide">Desired Salary</p>
                          <p className="text-sm font-medium text-cp-dark">{selectedCandidateDetails.desiredSalary}</p>
                        </div>
                      )}
                      {selectedCandidateDetails.address && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-cp-gray uppercase tracking-wide">Location</p>
                          <p className="text-sm font-medium text-cp-dark">
                            {[
                              selectedCandidateDetails.address?.city,
                              selectedCandidateDetails.address?.state,
                              selectedCandidateDetails.address?.country
                            ].filter(Boolean).join(', ') || '-'}
                          </p>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-cp-gray uppercase tracking-wide">Applied</p>
                        <p className="text-sm font-medium text-cp-dark">{formatDate(selectedCandidate.appliedDate)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-cp-gray uppercase tracking-wide">Source</p>
                        <p className="text-sm font-medium text-cp-dark">{selectedCandidate.source || '-'}</p>
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {selectedCandidateDetails && (selectedCandidateDetails.resumeFileId || selectedCandidateDetails.hasResume || selectedCandidateDetails.coverLetterFileId) && (
                    <div>
                      <p className="font-medium text-cp-dark text-sm mb-2">Documents</p>
                      <div className="flex gap-2">
                        {selectedCandidateDetails.resumeFileId ? (
                          <button
                            onClick={() => openCvPopup(
                              selectedCandidateId,
                              selectedCandidate.displayName,
                              selectedCandidateDetails.resumeFileId!
                            )}
                            className="flex items-center gap-2 px-3 py-2 bg-cp-blue text-white rounded-lg text-sm hover:bg-cp-dark transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View CV
                          </button>
                        ) : selectedCandidateDetails.hasResume ? (
                          <button
                            onClick={() => openCvPopup(
                              selectedCandidateId,
                              selectedCandidate.displayName
                            )}
                            className="flex items-center gap-2 px-3 py-2 bg-cp-blue text-white rounded-lg text-sm hover:bg-cp-dark transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View CV
                          </button>
                        ) : null}
                        {selectedCandidateDetails.coverLetterFileId && (
                          <button
                            onClick={() => openCvPopup(
                              selectedCandidateId,
                              `${selectedCandidate.displayName} - Cover Letter`,
                              selectedCandidateDetails.coverLetterFileId!
                            )}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-cp-blue text-cp-blue rounded-lg text-sm hover:bg-cp-light transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Cover Letter
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Q&A Accordion */}
                  {selectedCandidateDetails && selectedCandidateDetails.questionsAndAnswers.length > 0 && (
                    <div>
                      <p className="font-medium text-cp-dark text-sm mb-2">Application Questions</p>
                      <div className="space-y-2">
                        {selectedCandidateDetails.questionsAndAnswers.map((qa, i) => (
                          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedQA(expandedQA === i ? null : i)}
                              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
                            >
                              <span className="text-sm font-medium text-cp-dark pr-4">{qa.question}</span>
                              <svg
                                className={`w-4 h-4 text-cp-gray transition-transform ${expandedQA === i ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {expandedQA === i && (
                              <div className="px-3 pb-3 text-sm text-cp-gray border-t border-gray-100 pt-2">
                                {qa.answer || 'No answer provided'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CV Popup Modal */}
      {cvPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-cp-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-cp-dark">{cvPopup.candidateName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={cvPopup.fileId
                    ? `/api/candidates/${cvPopup.candidateId}/resume?fileId=${cvPopup.fileId}`
                    : `/api/candidates/${cvPopup.candidateId}/resume`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-sm bg-cp-light text-cp-dark rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Open in New Tab
                </a>
                <button
                  onClick={closeCvPopup}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-cp-gray"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe
                src={cvPopup.fileId
                  ? `/api/candidates/${cvPopup.candidateId}/resume?fileId=${cvPopup.fileId}`
                  : `/api/candidates/${cvPopup.candidateId}/resume`
                }
                className="w-full h-full border-0"
                title={`CV - ${cvPopup.candidateName}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
