import type { Metadata } from "next";
import "./globals.css";
import "./workspace-content.css";
import "./attendance-theme.css";

export const metadata: Metadata = {
  title: "Be My Admin",
  description: "Simple people, attendance, and leave management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
