import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lattice — Personal Knowledge Retrieval",
  description:
    "A self-hosted personal knowledge system that mirrors your Obsidian vault from S3 and exposes a secure web UI for grounded retrieval.",
};

const themeBootScript = `
  (function () {
    try {
      var stored = window.localStorage.getItem("lattice-theme");
      var theme = stored || "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (e) {
      document.documentElement.dataset.theme = "light";
      document.documentElement.style.colorScheme = "light";
    }
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
      </body>
    </html>
  );
}
