import { NextResponse } from 'next/server';
import { fetchEmployeeReport } from '@/lib/bamboohr';

export interface AnniversaryEmployee {
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  hireDate: string;
  yearsOfService: number;
  anniversaryMonth: number;
}

export async function GET() {
  try {
    const employees = await fetchEmployeeReport();

    // Transform employees to anniversary format
    const now = new Date();
    const currentYear = now.getFullYear();

    const anniversaryEmployees: AnniversaryEmployee[] = employees
      .filter(emp => emp.hireDate) // Only include employees with hire dates
      .map(emp => {
        const hireDate = new Date(emp.hireDate);
        const anniversaryMonth = hireDate.getMonth(); // 0-11

        // Calculate years of service
        let yearsOfService = currentYear - hireDate.getFullYear();

        // Adjust if anniversary hasn't happened yet this year
        const thisYearAnniversary = new Date(currentYear, anniversaryMonth, hireDate.getDate());
        if (now < thisYearAnniversary) {
          yearsOfService--;
        }

        return {
          firstName: emp.firstName,
          lastName: emp.lastName,
          department: emp.department,
          location: emp.location,
          hireDate: emp.hireDate,
          yearsOfService: Math.max(0, yearsOfService),
          anniversaryMonth,
        };
      });

    // Group by month
    const employeesByMonth: Record<number, AnniversaryEmployee[]> = {};
    for (let i = 0; i < 12; i++) {
      employeesByMonth[i] = [];
    }

    anniversaryEmployees.forEach(emp => {
      employeesByMonth[emp.anniversaryMonth].push(emp);
    });

    // Sort each month by years of service (descending)
    for (const month in employeesByMonth) {
      employeesByMonth[month].sort((a, b) => b.yearsOfService - a.yearsOfService);
    }

    return NextResponse.json({
      success: true,
      total: anniversaryEmployees.length,
      employeesByMonth,
    });
  } catch (error) {
    console.error('Error fetching anniversaries:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch anniversaries' },
      { status: 500 }
    );
  }
}
