import { ProjectActivity, ProjectAttachment, ProjectMember, ProjectTask, WorkflowStatus } from "@/types";

export type TaskPerson = { id: string; employeeId?: string; name: string; employeeCode?: string; jobTitle?: string };
export type TaskHistory = ProjectActivity & { actor: TaskPerson; fieldChanges: { field: string; label: string; before: string; after: string }[] };
export type TaskComment = { id: string; author: TaskPerson; body: string; createdAt: string; mentions: TaskPerson[] };
export type TaskWorklog = { id: string; employee: TaskPerson; startedAt: string; endedAt?: string; durationSeconds: number; stopReason?: string };
export type TaskDetailData = {
  task: ProjectTask & { creator: TaskPerson; reporter: TaskPerson; status: WorkflowStatus | null; parent: { id: string; key: string; title: string; isDeleted?: boolean } | null };
  project: { id: string; name: string; key: string; status: string; taskDurationOptionsMinutes?: number[]; autoCompleteStatusId?: string };
  permissions: { canEdit: boolean };
  workflow: WorkflowStatus[];
  children: { id: string; key: string; title: string; workflowStatusId: string }[];
  comments: TaskComment[];
  activity: TaskHistory[];
  activityPagination: { page: number; size: number; totalCount: number; hasMore: boolean };
  worklog: TaskWorklog[];
  worklogPagination: { page: number; size: number; totalCount: number; hasMore: boolean };
  worklogSummary: { trackedSeconds: number; legacySeconds: number; sessionCount: number };
  attachments: ProjectAttachment[];
};
export type TaskMembers = { members: ProjectMember[] };
