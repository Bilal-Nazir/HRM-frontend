"use client";
import Link from "next/link";
import { portalPrefix } from "@/lib/access";
import { getSession } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import AdminLeave from "@/components/AdminLeave";
import { PageHeader } from "@/components/ui";
export default function AdminLeavePage() {
  return (
    <AppShell>
      <PageHeader action={getSession()?.employeeId && <Link className="button button-secondary" href={`${portalPrefix(getSession())}/leave/me`}>My requests</Link>}
        eyebrow="Employee requests"
        title="Request management"
        description="Review and approve leave and Work-from-Home requests across your organization."
      />
      <AdminLeave />
    </AppShell>
  );
}
