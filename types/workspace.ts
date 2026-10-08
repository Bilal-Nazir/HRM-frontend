export type Terms = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};
export type Announcement = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
};
export type AnnouncementList = {
  announcements: Announcement[];
  totalCount: number;
  page: number;
  lastPage: number;
};
