export type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phone?: string;
  personalEmail?: string;
  timezone?: string;
  jobTitle?: string;
  employmentStatus: string;
  departmentId?: string;
  employmentType?: string;
  joinDate?: string;
  createdAt?: string;
};

export type Department = {
  id: string;
  name: string;
  code?: string;
  status: string;
};

export type Attendance = {
  employee?: { name: string; employeeCode: string } | null;
  id: string;
  employeeId?: string;
  workDate: string;
  checkInAt: string;
  checkOutAt?: string;
  status: string;
  checkInWithinGeofence?: boolean;
  checkOutWithinGeofence?: boolean;
  checkInLocation?: { latitude: number; longitude: number; accuracyMeters?: number; address?: string };
  checkOutLocation?: { latitude: number; longitude: number; accuracyMeters?: number; address?: string };
  workedHours?: number;
  flags?: string[];
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
  leaveTypeId?: string;
  requestKind?: "leave" | "work_from_home";
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: string;
  createdAt?: string;
};

export type Project = { id:string;name:string;key:string;description?:string;managerEmployeeId?:string;manager?:{id:string;name:string;employeeCode:string}|null;startDate?:string;targetEndDate?:string;priority:"low"|"medium"|"high"|"critical";status:"planned"|"active"|"on_hold"|"completed"|"archived";memberCount?:number;totalTasks?:number;completedTasks?:number;progress?:number;createdAt?:string;updatedAt?:string };
export type ProjectMember = { id:string;projectId:string;employeeId:string;role:"project_manager"|"member"|"viewer";status:string;employee:Employee|null };
export type WorkflowStatus = { id:string;projectId:string;name:string;order:number;category:"todo"|"in_progress"|"done";color:string;isDefault:boolean;isArchived:boolean;allowedTransitionIds:string[];moveRoles:string[] };
export type ProjectTask = { id:string;projectId:string;issueNumber:number;key:string;type:"story"|"task";title:string;description?:string;parentStoryId?:string;assigneeEmployeeIds:string[];assignees?:{id:string;name:string;employeeCode:string;jobTitle?:string}[];priority:"low"|"medium"|"high"|"critical";workflowStatusId:string;startDate?:string;dueDate?:string;estimatedHours?:number;labels:string[];timeStartedAt?:string;timeStoppedAt?:string;accumulatedSeconds?:number;createdAt?:string;updatedAt?:string;project?:Project };
export type ProjectActivity = { id:string;projectId:string;taskId?:string;actorEmployeeId?:string;action:string;changes?:Record<string,unknown>;createdAt:string };
export type ProjectComment = { id:string;taskId:string;authorEmployeeId:string;body:string;createdAt:string };
export type ProjectAttachment = { id:string;taskId:string;originalName:string;mimeType:string;size:number;uploadedByEmployeeId?:string;createdAt:string };
