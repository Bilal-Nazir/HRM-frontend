"use client";
import AppShell from "@/components/AppShell";
import AdminLeave from "@/components/AdminLeave";
import { PageHeader } from "@/components/ui";
export default function AdminLeavePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Time away"
        title="Leave management"
        description="Review and approve leave requests across your organization."
      />
      <AdminLeave />
    </AppShell>
  );
}
