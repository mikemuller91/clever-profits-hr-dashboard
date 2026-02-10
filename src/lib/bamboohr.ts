// BambooHR API Integration

export interface Employee {
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

export interface BambooEmployee {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  hireDate?: string;
  department?: string;
  location?: string;
  dateOfBirth?: string;
  payRate?: string;
}

const BAMBOO_API_KEY = process.env.BAMBOO_API_KEY;
const BAMBOO_SUBDOMAIN = process.env.BAMBOO_SUBDOMAIN;

function getAuthHeader(): string {
  // BambooHR uses Basic Auth with API key as username and 'x' as password
  const credentials = Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64');
  return `Basic ${credentials}`;
}

export async function fetchEmployees(): Promise<Employee[]> {
  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    throw new Error('BambooHR credentials not configured. Please set BAMBOO_API_KEY and BAMBOO_SUBDOMAIN environment variables.');
  }

  const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

  // Fetch employee directory with custom fields
  // Fields: displayName, firstName, lastName, hireDate, department, location, dateOfBirth, payRate
  const fields = 'displayName,firstName,lastName,hireDate,department,location,dateOfBirth,payRate,status';
  const url = `${baseUrl}/employees/directory?fields=${fields}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BambooHR API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Filter out terminated employees (only include Active status)
  const activeEmployees = (data.employees || []).filter(
    (emp: BambooEmployee & { status?: string }) => emp.status === 'Active'
  );

  // Transform the response to our Employee interface
  const employees: Employee[] = activeEmployees.map((emp: BambooEmployee) => ({
    id: emp.id || '',
    displayName: emp.displayName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    firstName: emp.firstName || '',
    lastName: emp.lastName || '',
    hireDate: emp.hireDate || '',
    department: emp.department || 'Unassigned',
    location: emp.location || 'Unassigned',
    dateOfBirth: emp.dateOfBirth || '',
    salary: emp.payRate || '',
  }));

  return employees;
}

export async function fetchEmployeeReport(): Promise<Employee[]> {
  if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
    throw new Error('BambooHR credentials not configured.');
  }

  const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

  // Use the reports endpoint to get specific fields including salary
  const reportFields = [
    'displayName',
    'firstName',
    'lastName',
    'hireDate',
    'department',
    'location',
    'dateOfBirth',
    'payRate',
    'payType',
    'paidPer',
    'status',
  ];

  const url = `${baseUrl}/reports/custom?format=json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Employee Report',
      fields: reportFields,
    }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    // Fallback to directory if custom report fails
    console.log('Custom report failed, falling back to directory');
    return fetchEmployees();
  }

  const data = await response.json();

  // Filter out terminated employees (only include Active status)
  const activeEmployees = (data.employees || []).filter(
    (emp: BambooEmployee & { status?: string }) => emp.status === 'Active'
  );

  const employees: Employee[] = activeEmployees.map((emp: BambooEmployee & { payType?: string; paidPer?: string }) => {
    let salaryDisplay = '';
    if (emp.payRate) {
      const payType = emp.payType || '';
      const paidPer = emp.paidPer || '';
      salaryDisplay = `${emp.payRate}${paidPer ? ` / ${paidPer}` : ''}${payType ? ` (${payType})` : ''}`;
    }

    return {
      id: emp.id || '',
      displayName: emp.displayName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      hireDate: emp.hireDate || '',
      department: emp.department || 'Unassigned',
      location: emp.location || 'Unassigned',
      dateOfBirth: emp.dateOfBirth || '',
      salary: salaryDisplay,
    };
  });

  return employees;
}
