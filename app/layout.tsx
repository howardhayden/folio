import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hah.dev"),
  title: {
    default: "Hayden Howard — Systems, information, resilience",
    template: "%s — Hayden Howard",
  },
  description:
    "Hayden Howard develops and operates resilient systems that people can trust under pressure.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
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
