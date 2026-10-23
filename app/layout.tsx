import type { Metadata } from "next";
import "./globals.css";
import "./workspace-content.css";
import "./attendance-theme.css";
import "./themes.css";
import "./projects.css";

export const metadata: Metadata = {
  title: "Be My Admin",
  description: "Simple people, attendance, and leave management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('hrm_theme');var a=['emerald','midnight-coral','indigo-sky','violet-aqua','orchid-mint','azure-sun','obsidian-rose'];document.documentElement.dataset.theme=a.indexOf(t)>-1?t:'emerald'}catch(e){document.documentElement.dataset.theme='emerald'}})();` }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
