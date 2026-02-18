'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Candidate, CandidateDetail, JobOpening, CandidateStatus, CandidateRating } from '@/types/candidates';

export default function CandidatesDashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [universityFilter, setUniversityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<Record<string, CandidateDetail>>({});
  const [candidateRatings, setCandidateRatings] = useState<Record<string, CandidateRating>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof Candidate>('appliedDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [availableStatuses, setAvailableStatuses] = useState<CandidateStatus[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Bulk selection state
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [bulkStatusDropdownOpen, setBulkStatusDropdownOpen] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const bulkDropdownRef = useRef<HTMLDivElement>(null);

  // CV popup state
  const [cvPopup, setCvPopup] = useState<{ candidateId: string; fileId: number; candidateName: string } | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  // Keyword search state
  const [keywordSearch, setKeywordSearch] = useState('');
  const [searchCvs, setSearchCvs] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    keyword: string;
    totalResults: number;
    results: {
      candidateId: string;
      candidateName: string;
      email: string;
      jobTitle: string;
      matches: {
        type: 'question' | 'cv';
        question?: string;
        answer?: string;
        cvExcerpt?: string;
      }[];
    }[];
  } | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(null);
      }
      if (bulkDropdownRef.current && !bulkDropdownRef.current.contains(event.target as Node)) {
        setBulkStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear selection when job changes
  useEffect(() => {
    setSelectedCandidates(new Set());
  }, [selectedJobId]);

  // Fetch available statuses on mount
  useEffect(() => {
    async function loadStatuses() {
      try {
        const response = await fetch('/api/candidates/statuses');
        const data = await response.json();
        if (response.ok && data.statuses) {
          setAvailableStatuses(data.statuses);
        }
      } catch (err) {
        console.error('Error fetching statuses:', err);
      }
    }
    loadStatuses();
  }, []);

  useEffect(() => {
    async function loadCandidates() {
      try {
        setLoading(true);
        const response = await fetch('/api/candidates');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch candidates');
        }

        setCandidates(data.candidates || []);
        setJobOpenings(data.jobOpenings || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadCandidates();
  }, []);

  // Get unique statuses for filter
  const statuses = useMemo(() => {
    const statusSet = new Set(candidates.map(c => c.status).filter(Boolean));
    return ['all', ...Array.from(statusSet).sort()];
  }, [candidates]);

  // Get unique universities for filter
  const universities = useMemo(() => {
    const uniSet = new Set(candidates.map(c => c.institution).filter(Boolean) as string[]);
    return ['all', ...Array.from(uniSet).sort()];
  }, [candidates]);

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    let result = candidates;

    // Filter by selected job
    if (selectedJobId !== null) {
      result = result.filter(c => c.jobId === selectedJobId);
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    // Filter by rating
    if (ratingFilter !== 'all') {
      const minRating = parseInt(ratingFilter, 10);
      result = result.filter(c => c.rating !== null && c.rating >= minRating);
    }

    // Filter by university
    if (universityFilter !== 'all') {
      result = result.filter(c => c.institution === universityFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.displayName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
      );
    }

    result = [...result].sort((a, b) => {
      // Special handling for rating column - sort numerically
      if (sortColumn === 'rating') {
        const aVal = a.rating ?? -1;
        const bVal = b.rating ?? -1;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      if (sortDirection === 'asc') {
        return String(aVal).localeCompare(String(bVal));
      } else {
        return String(bVal).localeCompare(String(aVal));
      }
    });

    return result;
  }, [candidates, selectedJobId, statusFilter, ratingFilter, universityFilter, searchTerm, sortColumn, sortDirection]);

  const selectedJob = jobOpenings.find(j => j.id === selectedJobId);

  const handleSort = (column: keyof Candidate) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

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

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('hired') || s.includes('offer accepted')) return 'bg-green-100 text-green-800';
    if (s.includes('interview') || s.includes('screening')) return 'bg-blue-100 text-blue-800';
    if (s.includes('reject') || s.includes('declined') || s.includes('withdrew')) return 'bg-red-100 text-red-800';
    if (s.includes('offer')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600 bg-green-100';
    if (rating >= 6) return 'text-blue-600 bg-blue-100';
    if (rating >= 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getConfidenceLabel = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return { text: 'High confidence', color: 'text-green-600' };
      case 'medium': return { text: 'Medium confidence', color: 'text-yellow-600' };
      case 'low': return { text: 'Low confidence', color: 'text-red-600' };
    }
  };

  const fetchCandidateDetails = async (candidateId: string) => {
    if (candidateDetails[candidateId]) {
      // Already loaded, just toggle expansion
      setExpandedCandidate(expandedCandidate === candidateId ? null : candidateId);
      return;
    }

    setLoadingDetails(candidateId);
    try {
      // Fetch details and rating in parallel
      const [detailsResponse, ratingResponse] = await Promise.all([
        fetch(`/api/candidates/${candidateId}`),
        fetch(`/api/candidates/${candidateId}/rating`),
      ]);

      const detailsData = await detailsResponse.json();
      if (!detailsResponse.ok) {
        throw new Error(detailsData.error || 'Failed to fetch candidate details');
      }

      setCandidateDetails(prev => ({ ...prev, [candidateId]: detailsData }));

      // Rating is optional - don't fail if it errors
      if (ratingResponse.ok) {
        const ratingData = await ratingResponse.json();
        setCandidateRatings(prev => ({ ...prev, [candidateId]: ratingData }));
      }

      setExpandedCandidate(candidateId);
    } catch (err) {
      console.error('Error fetching candidate details:', err);
    } finally {
      setLoadingDetails(null);
    }
  };

  const handleStatusChange = async (candidateId: string, newStatusId: number, newStatusName: string) => {
    setUpdatingStatus(candidateId);
    setStatusError(null);
    setStatusDropdownOpen(null);

    try {
      const response = await fetch(`/api/candidates/${candidateId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId: newStatusId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      // Update local state
      setCandidates(prev =>
        prev.map(c =>
          c.id === candidateId
            ? { ...c, status: newStatusName, statusId: newStatusId }
            : c
        )
      );

      // Also update candidate details if loaded
      if (candidateDetails[candidateId]) {
        setCandidateDetails(prev => ({
          ...prev,
          [candidateId]: { ...prev[candidateId], status: newStatusName, statusId: newStatusId },
        }));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setStatusError(err instanceof Error ? err.message : 'Failed to update status');
      // Auto-clear error after 5 seconds
      setTimeout(() => setStatusError(null), 5000);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Bulk selection handlers
  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.size === filteredCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(filteredCandidates.map(c => c.id)));
    }
  };

  const handleBulkStatusChange = async (newStatusId: number, newStatusName: string) => {
    if (selectedCandidates.size === 0) return;

    setBulkUpdating(true);
    setBulkStatusDropdownOpen(false);
    setStatusError(null);

    try {
      const response = await fetch('/api/candidates/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds: Array.from(selectedCandidates),
          statusId: newStatusId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update statuses');
      }

      // Update local state for all selected candidates
      setCandidates(prev =>
        prev.map(c =>
          selectedCandidates.has(c.id)
            ? { ...c, status: newStatusName, statusId: newStatusId }
            : c
        )
      );

      // Clear selection after successful update
      setSelectedCandidates(new Set());
    } catch (err) {
      console.error('Error bulk updating status:', err);
      setStatusError(err instanceof Error ? err.message : 'Failed to update statuses');
      setTimeout(() => setStatusError(null), 5000);
    } finally {
      setBulkUpdating(false);
    }
  };

  // CV popup handler
  const openCvPopup = (candidateId: string, fileId: number, candidateName: string) => {
    setCvPopup({ candidateId, fileId, candidateName });
    setCvError(null);
  };

  const closeCvPopup = () => {
    setCvPopup(null);
    setCvError(null);
  };

  // Keyword search handler
  const handleKeywordSearch = async () => {
    if (!keywordSearch.trim() || keywordSearch.trim().length < 2) {
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const response = await fetch('/api/candidates/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keywordSearch.trim(),
          jobId: selectedJobId,
          searchCv: searchCvs,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setStatusError(err instanceof Error ? err.message : 'Search failed');
      setTimeout(() => setStatusError(null), 5000);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setKeywordSearch('');
    setSearchResults(null);
    setShowSearchResults(false);
  };

  // Highlight search term in text
  const highlightMatch = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
      ) : (
        part
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
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
        <p className="text-sm text-cp-gray">
          Please ensure your BambooHR account has the ATS module enabled and your API key has the necessary permissions.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Error Toast */}
      {statusError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-pulse">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{statusError}</span>
          <button onClick={() => setStatusError(null)} className="ml-2 hover:opacity-80">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Job Openings Cards */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-cp-dark">
            {selectedJob ? `Applicants for: ${selectedJob.title}` : 'Select a Job Opening'}
          </h2>
          {selectedJobId !== null && (
            <button
              onClick={() => setSelectedJobId(null)}
              className="text-cp-blue hover:text-cp-dark transition-colors text-sm"
            >
              View All Jobs
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {jobOpenings.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
              className={`bg-white rounded-xl p-4 shadow-sm border-l-4 text-left transition-all hover:shadow-md ${
                selectedJobId === job.id
                  ? 'border-cp-blue ring-2 ring-cp-blue/20'
                  : 'border-cp-cyan hover:border-cp-blue'
              }`}
            >
              <p className="font-medium text-cp-dark text-sm line-clamp-2">{job.title}</p>
              <p className="text-2xl font-bold text-cp-dark mt-2">{job.candidateCount}</p>
              <p className="text-xs text-cp-gray">applicants</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters - only show when a job is selected */}
      {selectedJobId !== null && (
        <>
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-cp-gray mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none"
                />
              </div>

              <div className="min-w-[180px]">
                <label className="block text-sm font-medium text-cp-gray mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status === 'all' ? 'All Statuses' : status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px]">
                <label className="block text-sm font-medium text-cp-gray mb-1">Min Rating</label>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white"
                >
                  <option value="all">All Ratings</option>
                  <option value="8">8+ (Excellent)</option>
                  <option value="6">6+ (Good)</option>
                  <option value="4">4+ (Fair)</option>
                  <option value="1">1+ (Any rated)</option>
                </select>
              </div>

              <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-cp-gray mb-1">University</label>
                <select
                  value={universityFilter}
                  onChange={(e) => setUniversityFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white"
                >
                  {universities.map((uni) => (
                    <option key={uni} value={uni}>
                      {uni === 'all' ? 'All Universities' : uni}
                    </option>
                  ))}
                </select>
              </div>

              {(statusFilter !== 'all' || ratingFilter !== 'all' || universityFilter !== 'all' || searchTerm) && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setRatingFilter('all');
                    setUniversityFilter('all');
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 text-cp-blue hover:text-cp-dark transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Keyword Search */}
          <div className="bg-gradient-to-r from-cp-cyan/10 to-cp-blue/10 rounded-xl p-6 shadow-sm mb-6 border border-cp-blue/20">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-cp-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="font-semibold text-cp-dark">Keyword Search</h3>
              <span className="text-xs text-cp-gray">(Search across application answers and CVs)</span>
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[300px]">
                <input
                  type="text"
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
                  placeholder="Enter keywords (e.g., Python, CPA, MBA, marketing)..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchCvs}
                  onChange={(e) => setSearchCvs(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-cp-blue focus:ring-cp-blue"
                />
                <span className="text-sm text-cp-gray">Include CV content</span>
                {searchCvs && (
                  <span className="text-xs text-yellow-600">(slower)</span>
                )}
              </label>
              <button
                onClick={handleKeywordSearch}
                disabled={isSearching || keywordSearch.trim().length < 2}
                className="px-6 py-2 bg-cp-blue text-white rounded-lg hover:bg-cp-dark transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </>
                )}
              </button>
              {searchResults && (
                <button
                  onClick={clearSearch}
                  className="px-4 py-2 text-cp-gray hover:text-cp-dark transition-colors"
                >
                  Clear Results
                </button>
              )}
            </div>
          </div>

          {/* Search Results */}
          {showSearchResults && searchResults && (
            <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden border border-cp-blue/20">
              <div className="p-4 border-b border-gray-100 bg-cp-light/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-cp-dark">
                      Search Results for &quot;{searchResults.keyword}&quot;
                    </h3>
                    <p className="text-sm text-cp-gray">
                      Found {searchResults.totalResults} candidate{searchResults.totalResults !== 1 ? 's' : ''} with matches
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSearchResults(false)}
                    className="text-cp-gray hover:text-cp-dark"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {searchResults.results.length === 0 ? (
                <div className="p-8 text-center text-cp-gray">
                  No matches found for &quot;{searchResults.keyword}&quot;
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {searchResults.results.map((result) => (
                    <div key={result.candidateId} className="p-4 hover:bg-cp-light/30">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-cp-dark">{result.candidateName}</p>
                          <p className="text-sm text-cp-gray">{result.email}</p>
                        </div>
                        <button
                          onClick={() => {
                            fetchCandidateDetails(result.candidateId);
                            setShowSearchResults(false);
                          }}
                          className="text-sm text-cp-blue hover:text-cp-dark"
                        >
                          View Details →
                        </button>
                      </div>
                      <div className="space-y-2">
                        {result.matches.map((match, idx) => (
                          <div
                            key={idx}
                            className={`text-sm p-2 rounded ${
                              match.type === 'cv'
                                ? 'bg-purple-50 border-l-2 border-purple-400'
                                : 'bg-blue-50 border-l-2 border-blue-400'
                            }`}
                          >
                            {match.type === 'question' ? (
                              <>
                                <p className="text-xs text-cp-gray uppercase mb-1">Application Answer</p>
                                <p className="font-medium text-cp-dark text-xs mb-1">{match.question}</p>
                                <p className="text-cp-gray">{highlightMatch(match.answer || '', searchResults.keyword)}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-purple-600 uppercase mb-1">CV Match</p>
                                <p className="text-cp-gray">{highlightMatch(match.cvExcerpt || '', searchResults.keyword)}</p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedCandidates.size > 0 && (
            <div className="bg-cp-blue/10 border border-cp-blue/20 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-medium text-cp-dark">
                  {selectedCandidates.size} candidate{selectedCandidates.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedCandidates(new Set())}
                  className="text-sm text-cp-gray hover:text-cp-dark"
                >
                  Clear selection
                </button>
              </div>
              <div className="relative" ref={bulkDropdownRef}>
                <button
                  onClick={() => setBulkStatusDropdownOpen(!bulkStatusDropdownOpen)}
                  disabled={bulkUpdating}
                  className="px-4 py-2 bg-cp-blue text-white rounded-lg hover:bg-cp-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkUpdating ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Updating...
                    </>
                  ) : (
                    <>
                      Change Status
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
                {bulkStatusDropdownOpen && availableStatuses.length > 0 && (
                  <div className="absolute right-0 z-20 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-60 overflow-auto">
                    {availableStatuses.map((status) => (
                      <button
                        key={status.id}
                        onClick={() => handleBulkStatusChange(status.id, status.name)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-cp-light transition-colors flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(status.name)}`}></span>
                        {status.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Candidates Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cp-dark text-white">
                    <th className="py-4 px-4 w-12">
                      <input
                        type="checkbox"
                        checked={filteredCandidates.length > 0 && selectedCandidates.size === filteredCandidates.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-cp-blue focus:ring-cp-blue cursor-pointer"
                      />
                    </th>
                    {[
                      { key: 'displayName', label: 'Candidate' },
                      { key: 'rating', label: 'Rating' },
                      { key: 'status', label: 'Status' },
                      { key: 'appliedDate', label: 'Applied Date' },
                      { key: 'source', label: 'Source' },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key as keyof Candidate)}
                        className="text-left py-4 px-6 font-medium cursor-pointer hover:bg-cp-blue/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {label}
                          {sortColumn === key && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="text-left py-4 px-6 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-cp-gray">
                        No candidates found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate, index) => (
                      <>
                        <tr
                          key={candidate.id || index}
                          className={`border-b border-gray-100 hover:bg-cp-light/50 transition-colors ${selectedCandidates.has(candidate.id) ? 'bg-cp-blue/5' : ''}`}
                        >
                          <td className="py-4 px-4">
                            <input
                              type="checkbox"
                              checked={selectedCandidates.has(candidate.id)}
                              onChange={() => toggleCandidateSelection(candidate.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 text-cp-blue focus:ring-cp-blue cursor-pointer"
                            />
                          </td>
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
                            {candidate.rating !== null ? (
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getRatingColor(candidate.rating)}`}>
                                  {candidate.rating}
                                </span>
                                {candidate.ratingConfidence === 'low' && (
                                  <span className="text-xs text-yellow-600" title="Limited data available">?</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-cp-gray text-sm">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="relative" ref={statusDropdownOpen === candidate.id ? dropdownRef : undefined}>
                              <button
                                onClick={() => setStatusDropdownOpen(statusDropdownOpen === candidate.id ? null : candidate.id)}
                                disabled={updatingStatus === candidate.id}
                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(candidate.status)} hover:ring-2 hover:ring-offset-1 hover:ring-cp-blue/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait flex items-center gap-1`}
                              >
                                {updatingStatus === candidate.id ? (
                                  <>
                                    <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full"></span>
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    {candidate.status || '-'}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </>
                                )}
                              </button>
                              {statusDropdownOpen === candidate.id && availableStatuses.length > 0 && (
                                <div className="absolute z-10 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-60 overflow-auto">
                                  {availableStatuses.map((status) => (
                                    <button
                                      key={status.id}
                                      onClick={() => handleStatusChange(candidate.id, status.id, status.name)}
                                      className={`w-full text-left px-3 py-2 text-sm hover:bg-cp-light transition-colors flex items-center gap-2 ${
                                        candidate.statusId === status.id ? 'bg-cp-light font-medium' : ''
                                      }`}
                                    >
                                      <span className={`w-2 h-2 rounded-full ${getStatusColor(status.name)}`}></span>
                                      {status.name}
                                      {candidate.statusId === status.id && (
                                        <svg className="w-4 h-4 ml-auto text-cp-blue" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-cp-gray">{formatDate(candidate.appliedDate)}</td>
                          <td className="py-4 px-6 text-cp-gray">{candidate.source || '-'}</td>
                          <td className="py-4 px-6">
                            <button
                              onClick={() => fetchCandidateDetails(candidate.id)}
                              disabled={loadingDetails === candidate.id}
                              className="text-cp-blue hover:text-cp-dark text-sm disabled:opacity-50"
                            >
                              {loadingDetails === candidate.id ? (
                                'Loading...'
                              ) : expandedCandidate === candidate.id ? (
                                'Hide Details'
                              ) : (
                                'View Details'
                              )}
                            </button>
                          </td>
                        </tr>
                        {/* Expanded details row */}
                        {expandedCandidate === candidate.id && candidateDetails[candidate.id] && (
                          <tr key={`${candidate.id}-details`} className="bg-cp-light/30">
                            <td colSpan={7} className="py-4 px-6">
                              <div className="space-y-4">
                                {/* AI Rating */}
                                {candidateRatings[candidate.id] && (
                                  <div className="bg-gradient-to-r from-cp-blue/10 to-cp-cyan/10 rounded-lg p-4 border border-cp-blue/20">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="font-medium text-cp-dark flex items-center gap-2">
                                        <svg className="w-5 h-5 text-cp-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        AI Rating
                                      </h4>
                                      <span className={`text-xs px-2 py-1 rounded ${getConfidenceLabel(candidateRatings[candidate.id].confidence).color}`}>
                                        {getConfidenceLabel(candidateRatings[candidate.id].confidence).text}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {/* Overall Score */}
                                      <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                                        <p className="text-xs text-cp-gray uppercase tracking-wide mb-1">Overall Score</p>
                                        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl font-bold ${getRatingColor(candidateRatings[candidate.id].overall)}`}>
                                          {candidateRatings[candidate.id].overall}
                                        </div>
                                        <p className="text-xs text-cp-gray mt-1">out of 10</p>
                                      </div>
                                      {/* Education Score */}
                                      <div className="bg-white rounded-lg p-3 shadow-sm">
                                        <p className="text-xs text-cp-gray uppercase tracking-wide">Education</p>
                                        <p className={`text-xl font-bold ${getRatingColor(candidateRatings[candidate.id].breakdown.education.score)}`}>
                                          {candidateRatings[candidate.id].breakdown.education.score}/10
                                        </p>
                                        {candidateRatings[candidate.id].breakdown.education.level && (
                                          <p className="text-xs text-cp-gray mt-1 capitalize">
                                            {candidateRatings[candidate.id].breakdown.education.level}
                                          </p>
                                        )}
                                        {candidateRatings[candidate.id].breakdown.education.institution && (
                                          <p className="text-xs text-cp-blue mt-0.5 capitalize truncate">
                                            {candidateRatings[candidate.id].breakdown.education.institution}
                                          </p>
                                        )}
                                      </div>
                                      {/* Experience Score */}
                                      <div className="bg-white rounded-lg p-3 shadow-sm">
                                        <p className="text-xs text-cp-gray uppercase tracking-wide">Experience</p>
                                        <p className={`text-xl font-bold ${getRatingColor(candidateRatings[candidate.id].breakdown.experience.score)}`}>
                                          {candidateRatings[candidate.id].breakdown.experience.score}/10
                                        </p>
                                        {candidateRatings[candidate.id].breakdown.experience.years !== null && (
                                          <p className="text-xs text-cp-gray mt-1">
                                            {candidateRatings[candidate.id].breakdown.experience.years} years
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {candidateRatings[candidate.id].dataSource.length > 0 && (
                                      <p className="text-xs text-cp-gray mt-3">
                                        Data sources: {candidateRatings[candidate.id].dataSource.join(', ')}
                                      </p>
                                    )}
                                    {candidateRatings[candidate.id].confidence === 'low' && (
                                      <p className="text-xs text-yellow-600 mt-2">
                                        Limited data available. Add application questions about education and experience for better ratings.
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Contact & Additional Info */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {candidateDetails[candidate.id].phoneNumber && (
                                    <div className="bg-white rounded-lg p-3 shadow-sm">
                                      <p className="text-xs text-cp-gray uppercase tracking-wide">Phone</p>
                                      <p className="text-sm font-medium text-cp-dark">{candidateDetails[candidate.id].phoneNumber}</p>
                                    </div>
                                  )}
                                  {candidateDetails[candidate.id].linkedinUrl && (
                                    <div className="bg-white rounded-lg p-3 shadow-sm">
                                      <p className="text-xs text-cp-gray uppercase tracking-wide">LinkedIn</p>
                                      <a href={candidateDetails[candidate.id].linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-cp-blue hover:underline">View Profile</a>
                                    </div>
                                  )}
                                  {candidateDetails[candidate.id].availableStartDate && (
                                    <div className="bg-white rounded-lg p-3 shadow-sm">
                                      <p className="text-xs text-cp-gray uppercase tracking-wide">Available Start</p>
                                      <p className="text-sm font-medium text-cp-dark">{formatDate(candidateDetails[candidate.id].availableStartDate)}</p>
                                    </div>
                                  )}
                                  {candidateDetails[candidate.id].desiredSalary && (
                                    <div className="bg-white rounded-lg p-3 shadow-sm">
                                      <p className="text-xs text-cp-gray uppercase tracking-wide">Desired Salary</p>
                                      <p className="text-sm font-medium text-cp-dark">{candidateDetails[candidate.id].desiredSalary}</p>
                                    </div>
                                  )}
                                  {candidateDetails[candidate.id].referredBy && (
                                    <div className="bg-white rounded-lg p-3 shadow-sm">
                                      <p className="text-xs text-cp-gray uppercase tracking-wide">Referred By</p>
                                      <p className="text-sm font-medium text-cp-dark">{candidateDetails[candidate.id].referredBy}</p>
                                    </div>
                                  )}
                                  {candidateDetails[candidate.id].address && (
                                    <div className="bg-white rounded-lg p-3 shadow-sm">
                                      <p className="text-xs text-cp-gray uppercase tracking-wide">Location</p>
                                      <p className="text-sm font-medium text-cp-dark">
                                        {[
                                          candidateDetails[candidate.id].address?.city,
                                          candidateDetails[candidate.id].address?.state,
                                          candidateDetails[candidate.id].address?.country
                                        ].filter(Boolean).join(', ') || '-'}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Documents (CV / Cover Letter) */}
                                {(candidateDetails[candidate.id].resumeFileId || candidateDetails[candidate.id].coverLetterFileId) && (
                                  <div>
                                    <p className="font-medium text-cp-dark text-sm mb-3">Documents:</p>
                                    <div className="flex gap-3">
                                      {candidateDetails[candidate.id].resumeFileId && (
                                        <button
                                          onClick={() => openCvPopup(
                                            candidate.id,
                                            candidateDetails[candidate.id].resumeFileId!,
                                            candidate.displayName
                                          )}
                                          className="flex items-center gap-2 px-4 py-2 bg-cp-blue text-white rounded-lg hover:bg-cp-dark transition-colors"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          View CV
                                        </button>
                                      )}
                                      {candidateDetails[candidate.id].coverLetterFileId && (
                                        <button
                                          onClick={() => openCvPopup(
                                            candidate.id,
                                            candidateDetails[candidate.id].coverLetterFileId!,
                                            `${candidate.displayName} - Cover Letter`
                                          )}
                                          className="flex items-center gap-2 px-4 py-2 bg-white border border-cp-blue text-cp-blue rounded-lg hover:bg-cp-light transition-colors"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                          </svg>
                                          View Cover Letter
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Questions and Answers */}
                                {candidateDetails[candidate.id].questionsAndAnswers.length > 0 && (
                                  <div>
                                    <p className="font-medium text-cp-dark text-sm mb-3">Application Questions:</p>
                                    <div className="space-y-3">
                                      {candidateDetails[candidate.id].questionsAndAnswers.map((qa, i) => (
                                        <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                                          <p className="text-sm font-medium text-cp-dark">{qa.question}</p>
                                          <p className="text-sm text-cp-gray mt-1">{qa.answer || 'No answer provided'}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-4 text-sm text-cp-gray text-center">
            Showing {filteredCandidates.length} of {selectedJob?.candidateCount || 0} applicants for this position
          </div>
        </>
      )}

      {/* Show message when no job is selected */}
      {selectedJobId === null && (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <div className="text-cp-gray">
            <svg className="w-16 h-16 mx-auto mb-4 text-cp-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium text-cp-dark mb-2">Select a job opening above</p>
            <p className="text-cp-gray">Click on any job card to view its applicants</p>
          </div>
        </div>
      )}

      {/* CV Popup Modal */}
      {cvPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-cp-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-cp-dark">{cvPopup.candidateName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/candidates/${cvPopup.candidateId}/resume?fileId=${cvPopup.fileId}`}
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

            {/* Modal Content - PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe
                src={`/api/candidates/${cvPopup.candidateId}/resume?fileId=${cvPopup.fileId}`}
                className="w-full h-full border-0"
                title={`CV - ${cvPopup.candidateName}`}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
