import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remote Sensing Band Explorer",
  description: "Explore remote sensing sources, bands, formulas, and real scene metadata.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
