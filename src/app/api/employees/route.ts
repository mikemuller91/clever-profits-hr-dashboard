import { NextResponse } from 'next/server';
import { fetchEmployeeReport } from '@/lib/bamboohr';

export async function GET() {
  try {
    const employees = await fetchEmployeeReport();
    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}
