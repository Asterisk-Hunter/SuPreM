import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuPreM",
  description: "AI-powered CT scan analysis and diagnostic reporting",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
