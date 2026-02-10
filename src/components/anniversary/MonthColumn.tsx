'use client';

import { useState } from 'react';
import { AnniversaryEmployee } from '@/types/anniversary';
import EmployeeCard from './EmployeeCard';

interface MonthColumnProps {
  month: number;
  employees: AnniversaryEmployee[];
  isCurrentMonth: boolean;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthColumn({
  month,
  employees,
  isCurrentMonth,
}: MonthColumnProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentMonth || employees.length > 0);

  return (
    <div className="flex flex-col items-center">
      {/* Timeline node */}
      <div className="relative">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
            isCurrentMonth
              ? 'bg-cp-blue text-white ring-4 ring-cp-blue/30'
              : employees.length > 0
              ? 'bg-cp-cyan text-white'
              : 'bg-gray-300 text-gray-600'
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
          title={`${MONTH_FULL_NAMES[month]} - ${employees.length} anniversaries`}
        >
          {employees.length > 0 ? employees.length : ''}
        </div>
        {/* Month label */}
        <div
          className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap ${
            isCurrentMonth ? 'text-cp-blue' : 'text-cp-gray'
          }`}
        >
          {MONTH_NAMES[month]}
        </div>
      </div>

      {/* Expandable content */}
      <div
        className={`mt-10 transition-all duration-300 overflow-hidden ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className={`w-56 rounded-lg ${
            isCurrentMonth
              ? 'bg-cp-blue/10 border-2 border-cp-blue/50'
              : 'bg-gray-50 border border-gray-200'
          }`}
        >
          <div
            className={`px-3 py-2 rounded-t-lg flex items-center justify-between cursor-pointer ${
              isCurrentMonth ? 'bg-cp-blue/20' : 'bg-gray-100'
            }`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div>
              <h2
                className={`font-semibold text-sm ${
                  isCurrentMonth ? 'text-cp-dark' : 'text-cp-gray'
                }`}
              >
                {MONTH_FULL_NAMES[month]}
              </h2>
              <p
                className={`text-xs ${
                  isCurrentMonth ? 'text-cp-blue' : 'text-gray-500'
                }`}
              >
                {employees.length} anniversar{employees.length === 1 ? 'y' : 'ies'}
              </p>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              } ${isCurrentMonth ? 'text-cp-blue' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-3">
                No anniversaries
              </p>
            ) : (
              employees.map((employee, index) => (
                <EmployeeCard
                  key={`${employee.lastName}-${employee.firstName}-${index}`}
                  employee={employee}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
