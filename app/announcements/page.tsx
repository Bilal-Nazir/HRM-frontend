"use client";
import { getSession } from "@/lib/auth";
import CompanyAnnouncementsPage from "@/components/CompanyAnnouncementsPage";
import ManageAnnouncementsPage from "@/components/ManageAnnouncementsPage";
import { canManageContent } from "@/lib/workspace";
export default function Page() { return canManageContent(getSession()) ? <ManageAnnouncementsPage/> : <CompanyAnnouncementsPage/>; }
