"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatNavbarProps = {
  visible: boolean;
  title: string;
  engine: "qmd" | "opencode";
  folder: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
};

export function ChatNavbar({
  visible,
  title,
  engine,
  folder,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileSidebar
}: ChatNavbarProps) {
  return (
    <div
      className={cn(
        "chat-navbar-shell sticky top-0 z-20 overflow-hidden px-4 backdrop-blur-md transition-[max-height,padding,transform,opacity,border-color] duration-300 sm:px-6",
        visible
          ? "max-h-24 border-b border-[var(--border-subtle)] py-3 translate-y-0 opacity-100"
          : "max-h-0 border-b border-transparent py-0 -translate-y-full opacity-0 pointer-events-none"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:hidden"
            onClick={onOpenMobileSidebar}
            title="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:inline-flex"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-[600] leading-[1.4] text-[var(--text-primary)]">{title}</p>
            <p className="truncate text-[12px] leading-[1.45] text-[var(--text-tertiary)]">
              {folder || "All Sources"} · {engine.toUpperCase()}
            </p>
          </div>
        </div>
        <span className="linear-pill hidden shrink-0 rounded-full px-3 py-1 text-[11px] font-[600] uppercase tracking-[0.12em] sm:inline-flex">
          Chat mode
        </span>
      </div>
    </div>
  );
}
