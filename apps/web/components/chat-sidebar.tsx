"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LatticeMark } from "@/components/lattice-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ChatThreadSummary, DraftThreadSettings } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  activeThreadId: string | null;
  collapsed?: boolean;
  draftThreadSettings: DraftThreadSettings;
  disabled?: boolean;
  mobile?: boolean;
  threads: ChatThreadSummary[];
  onCreateThread: () => void;
  onSelectThread: (threadId: string) => void;
};

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));
}

export function ChatSidebar({
  activeThreadId,
  collapsed = false,
  draftThreadSettings,
  disabled = false,
  mobile = false,
  threads,
  onCreateThread,
  onSelectThread
}: ChatSidebarProps) {
  const sortedThreads = [...threads].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const activeThread = sortedThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const previousThreads = sortedThreads.filter((thread) => thread.id !== activeThreadId);
  const draftLabel = `${draftThreadSettings.folder || "All Sources"} · ${draftThreadSettings.engine.toUpperCase()}`;
  const isCollapsed = mobile ? false : collapsed;

  const sidebarBody = (
    <>
      <SidebarHeader className={isCollapsed ? "px-3 py-4" : undefined}>
        <div className={isCollapsed ? "flex justify-center" : "flex items-center gap-3"}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <LatticeMark className="h-4 w-4 text-[var(--text-primary)]/90" />
          </div>
          {!isCollapsed ? (
            <div>
              <p className="text-[15px] font-[600] leading-[1.4] text-[var(--text-primary)]">Lattice</p>
              <p className="text-[13px] leading-[1.5] text-[var(--text-tertiary)]">Scoped vault conversations</p>
            </div>
          ) : null}
        </div>

        <Button
          className={
            isCollapsed
              ? "sidebar-primary-button mt-4 w-full justify-center rounded-2xl px-0"
              : "sidebar-primary-button mt-4 w-full justify-start gap-2 rounded-2xl"
          }
          disabled={disabled}
          onClick={onCreateThread}
          title="New chat"
        >
          <MessageSquarePlus className="h-[18px] w-[18px] shrink-0" />
          {!isCollapsed ? "New chat" : null}
        </Button>
      </SidebarHeader>

      <SidebarContent className={mobile ? "px-0 py-1" : isCollapsed ? "px-2 py-4" : undefined}>
        {activeThread ? (
          <SidebarGroup className={mobile ? "mb-3" : undefined}>
            {!isCollapsed ? <SidebarGroupLabel>Current chat</SidebarGroupLabel> : null}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  active
                  className={isCollapsed ? "items-center px-0 py-2" : undefined}
                  disabled={disabled}
                  onClick={() => onSelectThread(activeThread.id)}
                  title={`${activeThread.title} · ${activeThread.folder || "All Sources"}`}
                >
                  {isCollapsed ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-current" />
                  ) : (
                    <>
                      <span className="line-clamp-2 text-[14px] font-[600] leading-[1.45]">{activeThread.title}</span>
                      <span className="text-[12px] leading-[1.45] text-[var(--text-tertiary)]">
                        {activeThread.folder || "All Sources"} · {activeThread.engine.toUpperCase()} · {formatTimestamp(activeThread.updatedAt)}
                      </span>
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          <SidebarGroup className={mobile ? "mb-3" : undefined}>
            {!isCollapsed ? <SidebarGroupLabel>Current chat</SidebarGroupLabel> : null}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  active
                  className={isCollapsed ? "items-center px-0 py-2" : undefined}
                  disabled={disabled}
                  onClick={onCreateThread}
                  title={`New chat · ${draftLabel}`}
                >
                  {isCollapsed ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-current" />
                  ) : (
                    <>
                      <span className="line-clamp-2 text-[14px] font-[600] leading-[1.45]">New chat</span>
                      <span className="text-[12px] leading-[1.45] text-[var(--text-tertiary)]">{draftLabel}</span>
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="mb-0">
          {!isCollapsed ? <SidebarGroupLabel className={mobile ? "px-1 py-0" : undefined}>Previous chats</SidebarGroupLabel> : null}
          <SidebarMenu className={mobile ? "space-y-0" : undefined}>
            {previousThreads.length > 0 ? (
              previousThreads.map((thread) => (
                <SidebarMenuItem key={thread.id}>
                  <SidebarMenuButton
                    className={mobile ? "rounded-md px-1 py-0.5" : isCollapsed ? "items-center px-0 py-2" : undefined}
                    disabled={disabled}
                    onClick={() => onSelectThread(thread.id)}
                    title={`${thread.title} · ${thread.folder || "All Sources"}`}
                  >
                    {isCollapsed ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-tertiary)]" />
                    ) : (
                      <>
                        <span className="line-clamp-2 text-[14px] font-[600] leading-[1.45]">{thread.title}</span>
                        <span
                          className={cn(
                            "text-[12px] leading-[1.45] text-[var(--text-tertiary)]",
                            mobile ? "text-[10.5px] leading-[1.25]" : undefined
                          )}
                        >
                          {thread.folder || "All Sources"} · {thread.engine.toUpperCase()} · {formatTimestamp(thread.updatedAt)}
                        </span>
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            ) : (
              !isCollapsed ? (
                <div
                  className={cn(
                    "rounded-2xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-[13px] leading-[1.6] text-[var(--text-tertiary)]",
                    mobile ? "rounded-md px-1.5 py-1.5" : undefined
                  )}
                >
                  Previous chats will appear here after you start new threads.
                </div>
              ) : null
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={isCollapsed ? "flex items-center justify-center" : "flex items-center justify-start"}>
        <ThemeToggle collapsed={isCollapsed} align={isCollapsed ? "center" : "left"} />
      </SidebarFooter>
    </>
  );

  if (mobile) {
    return <div className="flex h-full flex-col bg-[var(--bg-panel)]">{sidebarBody}</div>;
  }

  return <Sidebar className={isCollapsed ? "w-[76px]" : "w-[296px]"}>{sidebarBody}</Sidebar>;
}
