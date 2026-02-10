'use client';

import { AnniversaryEmployee } from '@/types/anniversary';

interface EmployeeCardProps {
  employee: AnniversaryEmployee;
}

function getYearsBadgeColor(years: number): string {
  if (years >= 20) return 'bg-cp-purple/20 text-cp-purple border-cp-purple/50';
  if (years >= 10) return 'bg-cp-dark/20 text-cp-dark border-cp-dark/50';
  if (years >= 5) return 'bg-cp-blue/20 text-cp-blue border-cp-blue/50';
  if (years >= 1) return 'bg-cp-cyan/20 text-cp-cyan border-cp-cyan/50';
  return 'bg-gray-100 text-gray-600 border-gray-300';
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
