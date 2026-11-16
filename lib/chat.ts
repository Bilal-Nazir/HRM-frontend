export type ChatPerson = {
  userId: string;
  employeeId?: string;
  name: string;
  employeeCode?: string;
  jobTitle?: string;
  photoVersion?: string;
};
export type ChatProject = {
  id: string;
  name: string;
  key: string;
  status: string;
};
export type ChatConversation = {
  id: string;
  kind: "direct" | "project";
  title: string;
  projectId?: string;
  projectKey?: string;
  isReadOnly: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  mentionCount?: number;
  otherUserId?: string;
  photoVersion?: string;
};
export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
  mentions: { userId: string; name: string }[];
  replyTo?: { id: string; authorName: string; body: string } | null;
  readCount: number;
  recipientCount: number;
};
export type ChatInbox = {
  conversations: ChatConversation[];
  unreadCount: number;
  unreadConversations: number;
  mentionCount: number;
};
export const filterChatPeople = (people: ChatPerson[], search: string) => {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter((person) => {
    const text =
      `${person.name} ${person.employeeCode || ""} ${person.jobTitle || ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
};
export const chatHref = (id?: string, admin = false, mentions = false) =>
  `${admin ? "/admin" : ""}/chat${id ? `?conversation=${encodeURIComponent(id)}${mentions ? "&mentions=1" : ""}` : ""}`;
export const chatInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const chatTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
export function chatDay(value: string) {
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? "Today"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}
