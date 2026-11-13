"use client";
import { getSession } from "@/lib/auth";
import PersonalAttendancePage from "@/components/PersonalAttendancePage";
import CompanyAttendancePage from "@/components/CompanyAttendancePage";
import { canViewCompanyReports } from "@/lib/access";
export default function Page() { return canViewCompanyReports(getSession()) ? <CompanyAttendancePage/> : <PersonalAttendancePage/>; }
