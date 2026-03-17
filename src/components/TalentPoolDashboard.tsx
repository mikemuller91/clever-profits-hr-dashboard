'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TalentPool, Candidate } from '@/types/candidates';
import { useCandidates } from '@/context/CandidatesContext';

export default function TalentPoolDashboard() {
  const {
    candidates,
    aiEvaluations,
    ensureLoaded,
    loading: candidatesLoading,
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

  function getAIScoreColor(score: number): string {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (score >= 6) return 'bg-blue-50 text-blue-700 ring-blue-200';
    if (score >= 4) return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  function getStatusColor(status: string): string {
    const s = status.toLowerCase();
    if (s === 'new') return 'bg-blue-100 text-blue-800';
    if (s.includes('review') || s.includes('screen')) return 'bg-purple-100 text-purple-800';
    if (s.includes('interview')) return 'bg-amber-100 text-amber-800';
    if (s.includes('offer')) return 'bg-emerald-100 text-emerald-800';
    if (s.includes('hired')) return 'bg-green-100 text-green-800';
    if (s.includes('reject') || s.includes('declined') || s.includes('withdraw')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  }

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

          {/* Pool Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cp-dark text-white">
                    <th className="text-left py-4 px-6 font-medium">Candidate</th>
                    <th className="text-left py-4 px-6 font-medium">AI Score</th>
                    <th className="text-left py-4 px-6 font-medium">Current Status</th>
                    <th className="text-left py-4 px-6 font-medium">Job Applied For</th>
                    <th className="text-left py-4 px-6 font-medium">Applied Date</th>
                    <th className="text-left py-4 px-6 font-medium">Source</th>
                    <th className="text-right py-4 px-6 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoolCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-cp-gray">
                        {poolCandidates.length === 0
                          ? 'No candidates in this pool yet. Click "Add Candidate" to get started.'
                          : 'No candidates match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPoolCandidates.map((candidate) => (
                      <tr
                        key={candidate.id}
                        className="border-b border-gray-100 hover:bg-cp-light/50 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cp-cyan text-white flex items-center justify-center font-medium text-sm">
                              {candidate.firstName?.[0] || '?'}
                              {candidate.lastName?.[0] || ''}
                            </div>
                            <div>
                              <span className="font-medium text-cp-dark">{candidate.displayName}</span>
                              <p className="text-xs text-cp-gray">{candidate.email || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {aiEvaluations[candidate.id] ? (
                            <div className={`inline-flex flex-col items-center justify-center w-10 h-10 rounded-lg ring-1 ${getAIScoreColor(aiEvaluations[candidate.id].score)}`}>
                              <span className="text-lg font-bold">{aiEvaluations[candidate.id].score}</span>
                              <span className="text-[8px] opacity-70">/10</span>
                            </div>
                          ) : (
                            <span className="text-cp-gray text-sm">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(candidate.status)}`}>
                            {candidate.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-cp-gray">
                          {candidate.jobTitle || '-'}
                        </td>
                        <td className="py-4 px-6 text-sm text-cp-gray">
                          {candidate.appliedDate
                            ? new Date(candidate.appliedDate).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="py-4 px-6 text-sm text-cp-gray">
                          {candidate.source || '-'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => removeCandidate(candidate.id)}
                            disabled={removingId === candidate.id}
                            className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {removingId === candidate.id ? 'Removing...' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pool summary */}
          <div className="mt-4 text-sm text-cp-gray">
            {filteredPoolCandidates.length} candidate{filteredPoolCandidates.length !== 1 ? 's' : ''} in {selectedPool.name}
          </div>
        </>
      )}
    </div>
  );
}
