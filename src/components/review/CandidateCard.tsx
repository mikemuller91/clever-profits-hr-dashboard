'use client';

import { useState } from 'react';
import { CandidateDetail, AIEvaluation } from '@/types/candidates';

interface CandidateCardProps {
  candidate: CandidateDetail;
  aiEvaluation: AIEvaluation | null;
  aiLoading: boolean;
}

export default function CandidateCard({ candidate, aiEvaluation, aiLoading }: CandidateCardProps) {
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100 ring-green-200';
    if (score >= 6) return 'text-blue-600 bg-blue-100 ring-blue-200';
    if (score >= 4) return 'text-yellow-600 bg-yellow-100 ring-yellow-200';
    return 'text-red-600 bg-red-100 ring-red-200';
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
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden h-full flex flex-col relative">
      {/* Header with AI Score */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-cp-cyan text-white flex items-center justify-center font-semibold text-base flex-shrink-0">
            {candidate.firstName?.[0] || '?'}
            {candidate.lastName?.[0] || ''}
          </div>

          {/* Name and Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-cp-dark">
                {candidate.displayName}
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(candidate.status)}`}>
                {candidate.status}
              </span>
            </div>
            <p className="text-sm text-cp-gray">
              {candidate.jobTitle}
            </p>
            <p className="text-xs text-cp-gray mt-0.5">
              Applied {formatDate(candidate.appliedDate)}
            </p>
          </div>

          {/* AI Score */}
          <div className="flex-shrink-0">
            {aiLoading ? (
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-cp-blue border-t-transparent"></div>
              </div>
            ) : aiEvaluation ? (
              <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ring-2 ${getScoreColor(aiEvaluation.score)}`}>
                <span className="text-2xl font-bold">{aiEvaluation.score}</span>
                <span className="text-[10px] opacity-70">/10</span>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                <span className="text-xs">N/A</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {aiEvaluation && (
          <div className="mt-3 p-3 bg-gradient-to-r from-cp-blue/5 to-cp-cyan/5 rounded-lg border border-cp-blue/10">
            <p className="text-sm text-cp-dark leading-relaxed">{aiEvaluation.summary}</p>

            {/* Strengths & Concerns */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {aiEvaluation.strengths.map((strength, i) => (
                <span key={`s-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {strength}
                </span>
              ))}
              {aiEvaluation.concerns.map((concern, i) => (
                <span key={`c-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {concern}
                </span>
              ))}
            </div>
          </div>
        )}

        {aiLoading && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-cp-blue border-t-transparent"></div>
            <span className="text-sm text-cp-gray">Generating AI evaluation...</span>
          </div>
        )}
      </div>

      {/* Resume PDF Viewer */}
      {candidate.resumeFileId ? (
        <div className="flex-1 min-h-[300px] bg-gray-100">
          <iframe
            src={`/api/candidates/${candidate.id}/resume?fileId=${candidate.resumeFileId}#toolbar=0&navpanes=0&view=FitH`}
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

      {/* Q&A Button */}
      {candidate.questionsAndAnswers.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setQaExpanded(true)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-cp-dark text-xs">
              Q&A ({candidate.questionsAndAnswers.length})
            </span>
            <svg
              className="w-4 h-4 text-cp-gray"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Q&A Modal Overlay */}
      {qaExpanded && candidate.questionsAndAnswers.length > 0 && (
        <div className="absolute inset-0 bg-white rounded-2xl z-10 flex flex-col">
          {/* Modal Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-2xl">
            <div>
              <h3 className="font-semibold text-cp-dark">Application Q&A</h3>
              <p className="text-xs text-cp-gray">{candidate.displayName}</p>
            </div>
            <button
              onClick={() => setQaExpanded(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-cp-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {candidate.questionsAndAnswers.map((qa, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-cp-dark mb-2">{qa.question}</p>
                  <p className="text-sm text-cp-gray whitespace-pre-wrap">{qa.answer || 'No answer provided'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white rounded-b-2xl">
            <button
              onClick={() => setQaExpanded(false)}
              className="w-full py-2 bg-cp-blue text-white rounded-lg hover:bg-cp-dark transition-colors text-sm font-medium"
            >
              Back to Resume
            </button>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="border-t border-gray-100 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {candidate.linkedinUrl && (
          <a
            href={candidate.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cp-blue hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            LinkedIn
          </a>
        )}
        {candidate.desiredSalary && (
          <span className="text-cp-gray">
            <span className="font-medium text-cp-dark">{candidate.desiredSalary}</span>
          </span>
        )}
        {candidate.availableStartDate && (
          <span className="text-cp-gray">
            Avail: <span className="font-medium text-cp-dark">{formatDate(candidate.availableStartDate)}</span>
          </span>
        )}
        {candidate.email && (
          <span className="text-cp-gray truncate max-w-[180px]">{candidate.email}</span>
        )}
      </div>
    </div>
  );
}
