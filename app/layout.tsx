import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IELTS Vocabulary Planner",
  description: "A recall-first IELTS vocabulary web app built with Next.js and Supabase PostgreSQL.",
  manifest: "/manifest.webmanifest",
  themeColor: "#6f847d"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
