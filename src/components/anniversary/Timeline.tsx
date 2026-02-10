'use client';

import { useEffect, useState, useRef } from 'react';
import { AnniversaryEmployee, AnniversaryResponse } from '@/types/anniversary';
import MonthColumn from './MonthColumn';

export default function Timeline() {
  const [data, setData] = useState<AnniversaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentMonth = new Date().getMonth();

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/anniversaries');
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch anniversaries');
        }

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Scroll to current month on load
  useEffect(() => {
    if (data && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const columnWidth = 100;
      const scrollPosition = currentMonth * columnWidth - container.clientWidth / 2 + columnWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollPosition), behavior: 'smooth' });
    }
  }, [data, currentMonth]);

  // Calculate average years of service
  const calculateAverageYears = (): number => {
    if (!data) return 0;

    const allEmployees: AnniversaryEmployee[] = [];
    for (const month in data.employeesByMonth) {
      allEmployees.push(...data.employeesByMonth[month]);
    }

    if (allEmployees.length === 0) return 0;

    const totalYears = allEmployees.reduce((sum, emp) => sum + emp.yearsOfService, 0);
    return totalYears / allEmployees.length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cp-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
        <p className="text-red-600">{error}</p>
        <p className="text-sm text-red-500 mt-4">
          Please ensure your BambooHR credentials are configured correctly.
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const months = Array.from({ length: 12 }, (_, i) => i);
  const averageYears = calculateAverageYears();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cp-dark">
            Employee Anniversaries
          </h1>
          <p className="text-cp-gray">{data.total} employees total</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-300"></span>
            &lt;1 year
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-cp-cyan"></span>
            1-4 years
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-cp-blue"></span>
            5-9 years
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-cp-dark"></span>
            10-19 years
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-cp-purple"></span>
            20+ years
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* Timeline container */}
          <div className="relative min-w-max px-8">
            {/* Connecting line */}
            <div className="absolute top-4 left-12 right-12 h-0.5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200"></div>

            {/* Progress line up to current month */}
            <div
              className="absolute top-4 left-12 h-0.5 bg-cp-blue"
              style={{ width: `calc(${(currentMonth / 11) * 100}% - 24px)` }}
            ></div>

            {/* Month nodes */}
            <div className="relative flex justify-between gap-2" style={{ minWidth: '1100px' }}>
              {months.map((month) => (
                <MonthColumn
                  key={month}
                  month={month}
                  employees={data.employeesByMonth[month] || []}
                  isCurrentMonth={month === currentMonth}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Average Length of Service */}
      <div className="bg-gradient-to-r from-cp-dark to-cp-blue rounded-xl shadow-lg p-6 text-center">
        <p className="text-cp-light/70 text-sm uppercase tracking-wide mb-1">
          Average Length of Service
        </p>
        <p className="text-white text-5xl font-bold">
          {averageYears.toFixed(1)}
        </p>
        <p className="text-cp-light/70 text-lg">years</p>
      </div>

      {/* Instructions */}
      <p className="text-center text-sm text-cp-gray">
        Click on a month circle or header to expand/collapse the employee list
      </p>
    </div>
  );
}
