"use client";

import { useEffect, useRef } from "react";
import { Globe, ArrowUp, SlidersHorizontal } from "lucide-react";
import { MobileChatSettings } from "@/components/mobile-chat-settings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InputGroup, InputGroupBody, InputGroupFooter } from "@/components/ui/input-group";
import { LoadingDots } from "@/components/ui/loading-dots";
import type { SourceFolder } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
  docked?: boolean;
  draftQuestion: string;
  onDraftQuestionChange: (value: string) => void;
  mobileSettingsOpen: boolean;
  onMobileSettingsOpenChange: (open: boolean) => void;
  selectedFolder: string;
  onFolderChange: (value: string) => void;
  sourceFolders: SourceFolder[];
  loadingFolders: boolean;
  loadingAnswer: boolean;
  sourcesError: string | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ChatComposer({
  docked = false,
  draftQuestion,
  onDraftQuestionChange,
  mobileSettingsOpen,
  onMobileSettingsOpenChange,
  selectedFolder,
  onFolderChange,
  sourceFolders,
  loadingFolders,
  loadingAnswer,
  sourcesError,
  onSubmit
}: ChatComposerProps) {
  const mobileTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = mobileTextareaRef.current;

    if (!textarea) {
      return;
    }

    const mobileMinHeight = 40;
    const mobileMaxHeight = 160;

    textarea.style.height = `${mobileMinHeight}px`;
    const nextHeight =
      textarea.scrollHeight > mobileMinHeight ? Math.min(textarea.scrollHeight, mobileMaxHeight) : mobileMinHeight;
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > mobileMaxHeight ? "auto" : "hidden";
  }, [draftQuestion]);

  function handleDesktopTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (loadingAnswer || !draftQuestion.trim()) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className={cn("w-full", docked ? "mx-auto max-w-[880px]" : "mx-auto max-w-[1040px]")}>
      <form onSubmit={onSubmit}>
        <InputGroup className={cn("overflow-hidden", docked ? "chat-composer-docked" : undefined)}>
          <InputGroupBody className="px-2 py-2 lg:px-2 lg:py-0">
            <div className="flex items-end gap-2 lg:block">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="linear-pill h-10 w-10 shrink-0 rounded-full lg:hidden"
                onClick={() => onMobileSettingsOpenChange(true)}
                title="Chat settings"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">Open chat settings</span>
              </Button>

              <div className="min-w-0 flex flex-1 items-end gap-0">
                <div className="min-w-0 flex-1">
                  <Textarea
                    ref={mobileTextareaRef}
                    value={draftQuestion}
                    onChange={(event) => onDraftQuestionChange(event.target.value)}
                    placeholder="Ask Lattice"
                    disabled={loadingAnswer}
                    className={cn(
                      "h-10 min-h-[40px] max-h-[160px] overflow-y-hidden overscroll-contain border-0 px-2 py-2 pr-1 text-[16px] leading-5 text-(--text-secondary) shadow-none ring-0 placeholder:text-(--text-tertiary) lg:hidden lg:px-4 lg:text-[18px]",
                      docked ? "text-[16px]" : "text-[16px]"
                    )}
                  />
                  <Textarea
                    value={draftQuestion}
                    onChange={(event) => onDraftQuestionChange(event.target.value)}
                    onKeyDown={handleDesktopTextareaKeyDown}
                    placeholder="Ask Lattice"
                    disabled={loadingAnswer}
                    className={cn(
                      "hidden px-2 text-[17px] text-(--text-secondary) placeholder:text-(--text-tertiary) lg:block lg:px-4 lg:text-[18px]",
                      docked ? "min-h-[52px] py-2.5 text-[16px]" : "min-h-[64px] py-3"
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loadingAnswer || !draftQuestion.trim()}
                  size="icon"
                  className="ml-0 h-10 w-10 shrink-0 rounded-full border-0 shadow-none before:hidden after:hidden lg:hidden"
                >
                  {loadingAnswer ? <LoadingDots className="scale-[0.9]" /> : <ArrowUp className="h-4 w-4" />}
                  <span className="sr-only">{loadingAnswer ? "Searching" : "Search"}</span>
                </Button>
              </div>
            </div>
          </InputGroupBody>

          <InputGroupFooter className={cn("hidden lg:flex", docked ? "chat-composer-footer" : undefined)}>
            <div className="flex flex-wrap items-center gap-3 text-(--text-tertiary)">
              <Select
                value={selectedFolder || "__all__"}
                onValueChange={(value) => onFolderChange(value === "__all__" ? "" : value)}
                disabled={loadingFolders || loadingAnswer}
              >
                <SelectTrigger
                  className={cn(
                    "linear-pill w-fit max-w-[280px] gap-3 border-(--border-strong) px-4 py-2 font-normal shadow-none transition-[width,padding,background-color,border-color,color] duration-300 ease-out",
                    docked ? "chat-composer-pill h-9" : "bg-(--bg-page)"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="truncate">
                      <SelectValue placeholder={loadingFolders ? "Loading folders..." : "All Sources"} />
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[240px]">
                  <SelectItem value="__all__">All Sources</SelectItem>
                  {sourceFolders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.path}>
                      {folder.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={loadingAnswer || !draftQuestion.trim()}
              size="icon"
              className={cn("rounded-full", docked ? "h-9 w-9" : "h-10 w-10")}
            >
              {loadingAnswer ? <LoadingDots className="scale-[0.9]" /> : <ArrowUp className="h-4 w-4" />}
              <span className="sr-only">{loadingAnswer ? "Searching" : "Search"}</span>
            </Button>
          </InputGroupFooter>
        </InputGroup>

        <MobileChatSettings
          open={mobileSettingsOpen}
          onOpenChange={onMobileSettingsOpenChange}
          selectedFolder={selectedFolder}
          onFolderChange={onFolderChange}
          sourceFolders={sourceFolders}
          loadingFolders={loadingFolders}
          loadingAnswer={loadingAnswer}
        />
      </form>

      {sourcesError ? <p className="px-1 pt-3 text-[14px] text-(--text-tertiary)">{sourcesError}</p> : null}
    </div>
  );
}
