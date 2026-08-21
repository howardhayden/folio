import type { Metadata } from "next";
import { SignalFuzzDefs } from "./components/SignalFuzz";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hah.dev"),
  title: {
    default: "hah.dev",
    template: "%s | hah.dev.",
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
      <body><SignalFuzzDefs />{children}</body>
    </html>
  );
}
