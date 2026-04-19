"use client";

import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { OpencodeModelId, OpencodeModelOption, SourceFolder } from "@/lib/schemas";

type MobileChatSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEngine: "qmd" | "opencode";
  onEngineChange: (value: "qmd" | "opencode") => void;
  selectedModel: OpencodeModelId;
  onModelChange: (value: OpencodeModelId) => void;
  selectedFolder: string;
  onFolderChange: (value: string) => void;
  opencodeModels: OpencodeModelOption[];
  sourceFolders: SourceFolder[];
  loadingFolders: boolean;
  loadingAnswer: boolean;
};

export function MobileChatSettings({
  open,
  onOpenChange,
  selectedEngine,
  onEngineChange,
  selectedModel,
  onModelChange,
  selectedFolder,
  onFolderChange,
  opencodeModels,
  sourceFolders,
  loadingFolders,
  loadingAnswer
}: MobileChatSettingsProps) {
  const selectedModelOption = opencodeModels.find((model) => model.id === selectedModel) ?? opencodeModels[0] ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="lg:hidden">
        <SheetHeader>
          <SheetTitle>Chat settings</SheetTitle>
          <SheetDescription>Choose the engine, model, and source scope for this conversation.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <p className="text-[12px] font-[600] uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Engine</p>
            <Select value={selectedEngine} onValueChange={(value) => onEngineChange(value as "qmd" | "opencode")} disabled={loadingAnswer}>
              <SelectTrigger className="linear-subsurface h-11 w-full min-w-0 rounded-2xl px-4 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qmd">QMD</SelectItem>
                <SelectItem value="opencode">OpenCode</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedEngine === "opencode" && opencodeModels.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[12px] font-[600] uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Model</p>
              <Select value={selectedModel} onValueChange={(value) => onModelChange(value as OpencodeModelId)} disabled={loadingAnswer}>
                <SelectTrigger className="linear-subsurface h-11 w-full min-w-0 justify-start rounded-2xl px-4 text-left shadow-none">
                  <span className="block min-w-0 flex-1 truncate text-left">
                    {selectedModelOption?.label ?? "OpenCode model"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {opencodeModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{model.label}</span>
                        <span className="break-words text-[12px] leading-[1.4] text-[var(--text-tertiary)]">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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
