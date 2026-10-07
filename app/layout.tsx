import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overwatch — Marketplace Monitoring",
  description: "Real-time marketplace and listing monitoring platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
