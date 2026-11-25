"use client";
import Link from "next/link";
import { Building2, ChevronDown } from "lucide-react";
import { getSession } from "@/lib/auth";
export default function CompanySwitcher() {
  const user = getSession();
  return (
    <Link
      className="company-switcher"
      href="/companies"
      aria-label="Switch or create a company"
    >
      <Building2 size={18} />
      <span>
        <small>
          {user?.isPlatformAdmin ? "Super Admin · viewing" : "Current company"}
        </small>
        <strong>{user?.companyName || "Choose a company"}</strong>
      </span>
      <ChevronDown size={16} />
    </Link>
  );
}
