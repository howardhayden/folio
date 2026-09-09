import type { Metadata } from "next";
import { TEXT_TO_LATTICE_DOCUMENT_POLICY } from "../workers/text-to-lattice-response-policy/worker.js";
import { SignalFuzzDefs } from "./components/SignalFuzz";
import { projects } from "./resume/projects.js";
import "./globals.css";

const textToLatticeEnabled = projects.some(
  (project) => project.id === "lattice" && String(project.interactiveRelease) === "enabled",
);

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
      <head>
        {textToLatticeEnabled ? (
          <meta
            content={TEXT_TO_LATTICE_DOCUMENT_POLICY["Content-Security-Policy"]}
            httpEquiv="Content-Security-Policy"
          />
        ) : null}
      </head>
      <body><SignalFuzzDefs />{children}</body>
    </html>
  );
}
