'use client';

import { useState, useEffect, useMemo } from 'react';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  jobTitle: string;
  status: string;
  appliedDate: string;
  source: string;
}

export default function CandidatesDashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
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
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadCandidates();
  }, []);

  // Get unique jobs and statuses for filters
  const jobs = useMemo(() => {
    const jobSet = new Set(candidates.map(c => c.jobTitle).filter(Boolean));
    return ['all', ...Array.from(jobSet).sort()];
  }, [candidates]);

  const statuses = useMemo(() => {
    const statusSet = new Set(candidates.map(c => c.status).filter(Boolean));
    return ['all', ...Array.from(statusSet).sort()];
  }, [candidates]);

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    let result = candidates;

    if (jobFilter !== 'all') {
      result = result.filter(c => c.jobTitle === jobFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.displayName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.jobTitle.toLowerCase().includes(term)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });

    return result;
  }, [candidates, jobFilter, statusFilter, searchTerm, sortColumn, sortDirection]);

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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-blue">
          <p className="text-cp-gray text-sm">Total Candidates</p>
          <p className="text-3xl font-bold text-cp-dark">{candidates.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-cyan">
          <p className="text-cp-gray text-sm">Open Positions</p>
          <p className="text-3xl font-bold text-cp-dark">{jobs.length - 1}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-purple">
          <p className="text-cp-gray text-sm">Statuses</p>
          <p className="text-3xl font-bold text-cp-dark">{statuses.length - 1}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-dark">
          <p className="text-cp-gray text-sm">Showing</p>
          <p className="text-3xl font-bold text-cp-dark">{filteredCandidates.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-cp-gray mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search candidates..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none"
            />
          </div>

          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-cp-gray mb-1">Job</label>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white"
            >
              {jobs.map((job) => (
                <option key={job} value={job}>
                  {job === 'all' ? 'All Jobs' : job}
                </option>
              ))}
            </select>
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

          {(jobFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setJobFilter('all');
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
                  { key: 'displayName', label: 'Candidate Name' },
                  { key: 'jobTitle', label: 'Position' },
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
                  <tr
                    key={candidate.id || index}
                    className="border-b border-gray-100 hover:bg-cp-light/50 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cp-cyan text-white flex items-center justify-center font-medium">
                          {candidate.firstName?.[0] || '?'}
                          {candidate.lastName?.[0] || ''}
                        </div>
                        <div>
                          <span className="font-medium text-cp-dark">{candidate.displayName}</span>
                          {candidate.email && (
                            <p className="text-xs text-cp-gray">{candidate.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-cp-gray">{candidate.jobTitle || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(candidate.status)}`}>
                        {candidate.status || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-cp-gray">{formatDate(candidate.appliedDate)}</td>
                    <td className="py-4 px-6 text-cp-gray">{candidate.source || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
