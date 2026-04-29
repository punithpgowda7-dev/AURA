import type { Metadata } from "next";
import "./globals.css";

// This is where we fix the "Create Next App" issue!
export const metadata: Metadata = {
  title: "AURA | AI Unified Response Analyzer",
  description: "A Unified Multi-Model Interface for Real-Time Comparative AI Response Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}