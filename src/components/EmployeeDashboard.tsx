'use client';

import { useState, useEffect, useMemo } from 'react';

interface Employee {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  hireDate: string;
  department: string;
  location: string;
  dateOfBirth: string;
  salary: string;
}

export default function EmployeeDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof Employee>('displayName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    async function loadEmployees() {
      try {
        setLoading(true);
        const response = await fetch('/api/employees');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch employees');
        }

        setEmployees(data.employees || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadEmployees();
  }, []);

  // Get unique departments and locations for filters
  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return ['all', ...Array.from(depts).sort()];
  }, [employees]);

  const locations = useMemo(() => {
    const locs = new Set(employees.map(e => e.location).filter(Boolean));
    return ['all', ...Array.from(locs).sort()];
  }, [employees]);

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    let result = employees;

    // Filter by department
    if (departmentFilter !== 'all') {
      result = result.filter(e => e.department === departmentFilter);
    }

    // Filter by location
    if (locationFilter !== 'all') {
      result = result.filter(e => e.location === locationFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e =>
        e.displayName.toLowerCase().includes(term) ||
        e.department.toLowerCase().includes(term) ||
        e.location.toLowerCase().includes(term)
      );
    }

    // Sort
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
  }, [employees, departmentFilter, locationFilter, searchTerm, sortColumn, sortDirection]);

  const handleSort = (column: keyof Employee) => {
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
      return new Date(dateString).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cp-dark mx-auto"></div>
          <p className="mt-4 text-cp-gray">Loading employees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-lg max-w-md mx-auto text-center">
        <div className="text-red-500 text-5xl mb-4">!</div>
        <h2 className="text-xl font-semibold text-cp-dark mb-2">Connection Error</h2>
        <p className="text-cp-gray mb-4">{error}</p>
        <p className="text-sm text-cp-gray">
          Please ensure your BambooHR credentials are configured correctly in the environment variables.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-blue">
            <p className="text-cp-gray text-sm">Total Employees</p>
            <p className="text-3xl font-bold text-cp-dark">{employees.length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-cyan">
            <p className="text-cp-gray text-sm">Departments</p>
            <p className="text-3xl font-bold text-cp-dark">{departments.length - 1}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-purple">
            <p className="text-cp-gray text-sm">Locations</p>
            <p className="text-3xl font-bold text-cp-dark">{locations.length - 1}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-cp-dark">
            <p className="text-cp-gray text-sm">Showing</p>
            <p className="text-3xl font-bold text-cp-dark">{filteredEmployees.length}</p>
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
                placeholder="Search employees..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none"
              />
            </div>

            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-cp-gray mb-1">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-cp-gray mb-1">Location</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cp-blue focus:border-transparent outline-none bg-white"
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc === 'all' ? 'All Locations' : loc}
                  </option>
                ))}
              </select>
            </div>

            {(departmentFilter !== 'all' || locationFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setDepartmentFilter('all');
                  setLocationFilter('all');
                  setSearchTerm('');
                }}
                className="px-4 py-2 text-cp-blue hover:text-cp-dark transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cp-dark text-white">
                  {[
                    { key: 'displayName', label: 'Employee Name' },
                    { key: 'department', label: 'Department' },
                    { key: 'location', label: 'Location' },
                    { key: 'hireDate', label: 'Hire Date' },
                    { key: 'dateOfBirth', label: 'Birth Date' },
                    { key: 'salary', label: 'Salary' },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key as keyof Employee)}
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
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-cp-gray">
                      No employees found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee, index) => (
                    <tr
                      key={employee.id || index}
                      className="border-b border-gray-100 hover:bg-cp-light/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cp-blue text-white flex items-center justify-center font-medium">
                            {employee.firstName?.[0] || employee.displayName?.[0] || '?'}
                            {employee.lastName?.[0] || ''}
                          </div>
                          <span className="font-medium text-cp-dark">{employee.displayName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-cp-gray">{employee.department || '-'}</td>
                      <td className="py-4 px-6 text-cp-gray">{employee.location || '-'}</td>
                      <td className="py-4 px-6 text-cp-gray">{formatDate(employee.hireDate)}</td>
                      <td className="py-4 px-6 text-cp-gray">{formatDate(employee.dateOfBirth)}</td>
                      <td className="py-4 px-6 text-cp-gray">{employee.salary || '-'}</td>
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
