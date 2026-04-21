'use client';

import { Candidate, AIEvaluation } from '@/types/candidates';

interface CandidateKanbanCardProps {
  candidate: Candidate;
  aiEvaluation?: AIEvaluation;
  onClick: () => void;
}

export default function CandidateKanbanCard({ candidate, aiEvaluation, onClick }: CandidateKanbanCardProps) {
  function getAIScoreColor(score: number): string {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (score >= 6) return 'bg-blue-50 text-blue-700 ring-blue-200';
    if (score >= 4) return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-lg p-3 shadow-sm border border-gray-100 hover:border-cp-blue/50 hover:shadow-md transition-all text-left cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-cp-cyan text-white flex items-center justify-center font-medium text-sm flex-shrink-0">
          {candidate.firstName?.[0] || '?'}{candidate.lastName?.[0] || ''}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-cp-dark text-sm truncate">{candidate.displayName}</p>
          <p className="text-xs text-cp-gray mt-0.5">
            Applied {formatDate(candidate.appliedDate)}
          </p>
        </div>

        {/* AI Score Badge */}
        {aiEvaluation && (
          <div className={`w-8 h-8 rounded-md ring-1 flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAIScoreColor(aiEvaluation.score)}`}>
            {aiEvaluation.score}
          </div>
        )}
      </div>
    </button>
  );
}
