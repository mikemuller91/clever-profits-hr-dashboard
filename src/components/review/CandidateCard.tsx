'use client';

import { useState } from 'react';
import { CandidateDetail } from '@/types/candidates';

interface CandidateCardProps {
  candidate: CandidateDetail;
  rating: number | null;
  ratingConfidence: 'high' | 'medium' | 'low' | null;
}

export default function CandidateCard({ candidate, rating, ratingConfidence }: CandidateCardProps) {
  const [qaExpanded, setQaExpanded] = useState(false);

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

  const getRatingColor = (r: number) => {
    if (r >= 8) return 'text-green-600 bg-green-100';
    if (r >= 6) return 'text-blue-600 bg-blue-100';
    if (r >= 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('hired') || s.includes('offer accepted')) return 'bg-green-100 text-green-800';
    if (s.includes('interview') || s.includes('screening')) return 'bg-blue-100 text-blue-800';
    if (s.includes('reject') || s.includes('declined') || s.includes('withdrew')) return 'bg-red-100 text-red-800';
    if (s.includes('offer')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-cp-cyan text-white flex items-center justify-center font-semibold text-lg flex-shrink-0">
          {candidate.firstName?.[0] || '?'}
          {candidate.lastName?.[0] || ''}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-cp-dark truncate">
            {candidate.displayName}
          </h2>
          <p className="text-sm text-cp-gray truncate">{candidate.jobTitle}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-cp-gray">Applied {formatDate(candidate.appliedDate)}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(candidate.status)}`}>
              {candidate.status}
            </span>
          </div>
        </div>
        {rating !== null && (
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${getRatingColor(rating)}`}>
              {rating}
            </div>
            {ratingConfidence && ratingConfidence !== 'high' && (
              <span className="text-xs text-yellow-600 mt-1">
                {ratingConfidence === 'low' ? '?' : '~'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Resume PDF Viewer */}
      {candidate.resumeFileId ? (
        <div className="flex-1 min-h-[300px] bg-gray-100">
          <iframe
            src={`/api/candidates/${candidate.id}/resume?fileId=${candidate.resumeFileId}`}
            className="w-full h-full border-0"
            title={`Resume - ${candidate.displayName}`}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-[300px] bg-gray-50 flex items-center justify-center">
          <div className="text-center text-cp-gray">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No resume uploaded</p>
          </div>
        </div>
      )}

      {/* Q&A Section (Collapsible) */}
      {candidate.questionsAndAnswers.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setQaExpanded(!qaExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-cp-dark text-sm">
              Application Q&A ({candidate.questionsAndAnswers.length})
            </span>
            <svg
              className={`w-5 h-5 text-cp-gray transition-transform ${qaExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {qaExpanded && (
            <div className="px-4 pb-4 max-h-60 overflow-y-auto">
              <div className="space-y-3">
                {candidate.questionsAndAnswers.map((qa, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-cp-dark mb-1">{qa.question}</p>
                    <p className="text-sm text-cp-gray">{qa.answer || 'No answer provided'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Additional Info */}
      <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap gap-3 text-xs">
        {candidate.linkedinUrl && (
          <a
            href={candidate.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cp-blue hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            LinkedIn
          </a>
        )}
        {candidate.desiredSalary && (
          <span className="text-cp-gray">
            Salary: <span className="font-medium text-cp-dark">{candidate.desiredSalary}</span>
          </span>
        )}
        {candidate.availableStartDate && (
          <span className="text-cp-gray">
            Available: <span className="font-medium text-cp-dark">{formatDate(candidate.availableStartDate)}</span>
          </span>
        )}
        {candidate.email && (
          <span className="text-cp-gray truncate max-w-[200px]">{candidate.email}</span>
        )}
      </div>
    </div>
  );
}
