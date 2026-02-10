export interface AnniversaryEmployee {
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  hireDate: string;
  yearsOfService: number;
  anniversaryMonth: number; // 0-11 (Jan-Dec)
}

export interface AnniversaryResponse {
  success: boolean;
  total: number;
  employeesByMonth: Record<number, AnniversaryEmployee[]>;
  error?: string;
}
