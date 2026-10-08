export type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phone?: string;
  jobTitle?: string;
  employmentStatus: string;
  departmentId?: string;
};

export type Attendance = {
  employee?: { name: string; employeeCode: string } | null;
  id: string;
  workDate: string;
  checkInAt: string;
  checkOutAt?: string;
  status: string;
  checkInWithinGeofence?: boolean;
};

export type LeaveType = {
  id: string;
  name: string;
  code?: string;
  annualAllowanceDays: number;
  isPaid: boolean;
};

export type LeaveRequest = {
  employee?: { name: string; employeeCode: string } | null;
  leaveTypeName?: string;
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: string;
};
