"use client";
import AppShell from "@/components/AppShell";
import AdminAttendance from "@/components/AdminAttendance";
import { PageHeader } from "@/components/ui";
export default function AdminAttendancePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Live operations"
        title="Attendance"
        description="See who is checked in and review employee work sessions."
      />
      <AdminAttendance />
    </AppShell>
  );
}
