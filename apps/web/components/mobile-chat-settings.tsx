"use client";

import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SourceFolder } from "@/lib/schemas";

type MobileChatSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFolder: string;
  onFolderChange: (value: string) => void;
  sourceFolders: SourceFolder[];
  loadingFolders: boolean;
  loadingAnswer: boolean;
};

export function MobileChatSettings({
  open,
  onOpenChange,
  selectedFolder,
  onFolderChange,
  sourceFolders,
  loadingFolders,
  loadingAnswer
}: MobileChatSettingsProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="lg:hidden">
        <SheetHeader>
          <SheetTitle>Chat settings</SheetTitle>
          <SheetDescription>Choose the source scope for this conversation.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <p className="text-[12px] font-[600] uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Sources</p>
            <Select
              value={selectedFolder || "__all__"}
              onValueChange={(value) => onFolderChange(value === "__all__" ? "" : value)}
              disabled={loadingFolders || loadingAnswer}
            >
              <SelectTrigger className="linear-subsurface h-11 w-full min-w-0 rounded-2xl px-4 shadow-none">
                <span className="flex min-w-0 w-full items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="truncate">
                    <SelectValue placeholder={loadingFolders ? "Loading folders..." : "All Sources"} />
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sources</SelectItem>
                {sourceFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.path}>
                    <span className="block truncate">{folder.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
