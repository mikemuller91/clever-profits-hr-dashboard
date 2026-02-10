'use client';

import { useState, useEffect, useMemo } from 'react';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  jobId: number | null;
  jobTitle: string;
  status: string;
  appliedDate: string;
  source: string;
  answers: { question: string; answer: string }[];
}

interface JobOpening {
  id: number;
  title: string;
  candidateCount: number;
}

export default function CandidatesDashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof Candidate>('appliedDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.displayName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      if (sortDirection === 'asc') {
        return String(aVal).localeCompare(String(bVal));
      } else {
        return String(bVal).localeCompare(String(aVal));
      }
    });

    return result;
  }, [candidates, selectedJobId, statusFilter, searchTerm, sortColumn, sortDirection]);

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

              {(statusFilter !== 'all' || searchTerm) && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 text-cp-blue hover:text-cp-dark transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Candidates Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-cp-dark text-white">
                    {[
                      { key: 'displayName', label: 'Candidate' },
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
                    <th className="text-left py-4 px-6 font-medium">Questions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-cp-gray">
                        No candidates found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate, index) => (
                      <>
                        <tr
                          key={candidate.id || index}
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
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(candidate.status)}`}>
                              {candidate.status || '-'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-cp-gray">{formatDate(candidate.appliedDate)}</td>
                          <td className="py-4 px-6 text-cp-gray">{candidate.source || '-'}</td>
                          <td className="py-4 px-6">
                            {candidate.answers && candidate.answers.length > 0 ? (
                              <button
                                onClick={() => setExpandedCandidate(
                                  expandedCandidate === candidate.id ? null : candidate.id
                                )}
                                className="text-cp-blue hover:text-cp-dark text-sm"
                              >
                                {expandedCandidate === candidate.id ? 'Hide' : 'View'} ({candidate.answers.length})
                              </button>
                            ) : (
                              <span className="text-cp-gray text-sm">None</span>
                            )}
                          </td>
                        </tr>
                        {/* Expanded answers row */}
                        {expandedCandidate === candidate.id && candidate.answers && candidate.answers.length > 0 && (
                          <tr key={`${candidate.id}-answers`} className="bg-cp-light/30">
                            <td colSpan={5} className="py-4 px-6">
                              <div className="space-y-3">
                                <p className="font-medium text-cp-dark text-sm">Application Questions:</p>
                                {candidate.answers.map((qa, i) => (
                                  <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                                    <p className="text-sm font-medium text-cp-dark">{qa.question}</p>
                                    <p className="text-sm text-cp-gray mt-1">{qa.answer || 'No answer provided'}</p>
                                  </div>
                                ))}
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
    </>
  );
}
