import type { Metadata } from "next";
import { SignalFuzzDefs } from "./components/SignalFuzz";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hah.dev"),
  referrer: "no-referrer",
  title: {
    default: "hah.dev",
    template: "%s | hah.dev.",
  },
  description:
    "Hayden Howard develops and operates resilient systems that people can trust under pressure.",
  authors: [{ name: "Hayden Howard", url: "https://hah.dev/" }],
  creator: "Hayden Howard",
  publisher: "Hayden Howard",
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
