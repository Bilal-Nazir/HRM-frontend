export type Terms = {
  files?: { id: string; name: string }[];
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};
export type Announcement = {
  category?: string;
  id: string;
  title: string;
  content: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
};
export type AnnouncementList = {
  categories?: string[];
  announcements: Announcement[];
  totalCount: number;
  page: number;
  lastPage: number;
};
