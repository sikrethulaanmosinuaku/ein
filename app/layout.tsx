import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avci Collections | Internet Archive",
  description: "A small, curated internet. Good jokes deserve a place on the wall.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
