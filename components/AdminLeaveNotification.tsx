"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useLiveData } from "@/lib/useLiveData";

export default function AdminLeaveNotification() {
  const { data, error } = useLiveData<{ totalCount: number }>(
    "/leave/requests/manage?status=pending&size=1",
  );
  return (
    <Link
      href="/admin/leave"
      className="button button-secondary admin-leave-notification"
      aria-label={
        error
          ? "Leave notifications unavailable. Open leave management."
          : `${data?.totalCount ?? "Loading"} pending leave requests`
      }
      title={
        error
          ? "Could not refresh leave notifications"
          : "Leave requests awaiting your review"
      }
    >
      <Bell size={18} />
      <span>Leave requests</span>
      <strong aria-live="polite">
        {error ? "!" : (data?.totalCount ?? "…")}
      </strong>
    </Link>
  );
}
