"use client";

import { useEffect, useState } from "react";
import { Moon, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

type ThemeToggleProps = {
  collapsed?: boolean;
  align?: "left" | "center";
};

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem("lattice-theme", theme);
}

export function ThemeToggle({ collapsed = false, align = "center" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const active = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(active);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  const icon =
    theme === "light" ? <Moon className="h-4 w-4" strokeWidth={1.9} /> : <SunMedium className="h-4 w-4" strokeWidth={1.9} />;

  return (
    <Button
      onClick={toggleTheme}
      variant="outline"
      size={collapsed ? "icon" : "sm"}
      className={cn(
        collapsed ? "h-10 w-10 rounded-full" : "gap-2.5 rounded-full px-4",
        !collapsed && align === "left" ? "justify-start" : undefined
      )}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
    >
      {icon}
      {!collapsed ? (theme === "light" ? "Dark mode" : "Light mode") : null}
    </Button>
  );
}
