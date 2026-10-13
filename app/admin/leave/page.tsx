"use client";
import AppShell from "@/components/AppShell";
import AdminLeave from "@/components/AdminLeave";
import { PageHeader } from "@/components/ui";
export default function AdminLeavePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Employee requests"
        title="Request management"
        description="Review and approve leave and Work-from-Home requests across your organization."
      />
      <AdminLeave />
    </AppShell>
  );
}
