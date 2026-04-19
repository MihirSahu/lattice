import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lattice",
  description: "Grounded retrieval over a mirrored Obsidian vault."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const themeBootScript = `
    (function () {
      try {
        var stored = window.localStorage.getItem("lattice-theme");
        var system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        var theme = stored || system;
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
      } catch (error) {
        document.documentElement.dataset.theme = "light";
        document.documentElement.style.colorScheme = "light";
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
      </body>
    </html>
  );
}
