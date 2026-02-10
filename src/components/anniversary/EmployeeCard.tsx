'use client';

import { AnniversaryEmployee } from '@/types/anniversary';

interface EmployeeCardProps {
  employee: AnniversaryEmployee;
}

function getYearsBadgeColor(years: number): string {
  if (years >= 5) return 'bg-purple-100 text-purple-700 border-purple-300';
  if (years >= 3) return 'bg-amber-100 text-amber-700 border-amber-300';
  if (years >= 1) return 'bg-green-100 text-green-700 border-green-300';
  return 'bg-gray-100 text-gray-500 border-gray-300';
}

export default function EmployeeCard({ employee }: EmployeeCardProps) {
  const badgeColor = getYearsBadgeColor(employee.yearsOfService);

  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-200 p-2 hover:shadow transition-shadow">
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-cp-dark text-sm truncate">
            {employee.firstName} {employee.lastName}
          </h3>
          <p className="text-xs text-cp-gray truncate">{employee.department}</p>
          {employee.location && (
            <p className="text-xs text-gray-400 truncate">{employee.location}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border ${badgeColor}`}
          title={`${employee.yearsOfService} years of service`}
        >
          {employee.yearsOfService}y
        </span>
      </div>
    </div>
  );
}
