"use client";
import AppShell from "@/components/AppShell";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import { PageHeader } from "@/components/ui";
export default function AnnouncementsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Office updates"
        title="Announcements"
        description="The latest news from your administration."
      />
      <AnnouncementsPanel compact={false} />
    </AppShell>
  );
}
