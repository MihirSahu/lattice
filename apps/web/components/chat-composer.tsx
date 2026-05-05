"use client";

import { useEffect, useRef } from "react";
import { Globe, ArrowUp, SlidersHorizontal } from "lucide-react";
import { MobileChatSettings } from "@/components/mobile-chat-settings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InputGroup, InputGroupBody, InputGroupFooter } from "@/components/ui/input-group";
import { LoadingDots } from "@/components/ui/loading-dots";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { shouldShowOpenAiRouteToggle } from "@/lib/chat-local-state";
import type { OpencodeModelId, OpencodeModelOption, OpencodeOpenAiRoute, SourceFolder } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
  docked?: boolean;
  draftQuestion: string;
  onDraftQuestionChange: (value: string) => void;
  selectedEngine: "qmd" | "opencode";
  onEngineChange: (value: "qmd" | "opencode") => void;
  selectedModel: OpencodeModelId;
  onModelChange: (value: OpencodeModelId) => void;
  selectedOpenAiRoute: OpencodeOpenAiRoute;
  onOpenAiRouteChange: (value: OpencodeOpenAiRoute) => void;
  mobileSettingsOpen: boolean;
  onMobileSettingsOpenChange: (open: boolean) => void;
  selectedFolder: string;
  onFolderChange: (value: string) => void;
  opencodeModels: OpencodeModelOption[];
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
  selectedEngine,
  onEngineChange,
  selectedModel,
  onModelChange,
  selectedOpenAiRoute,
  onOpenAiRouteChange,
  mobileSettingsOpen,
  onMobileSettingsOpenChange,
  selectedFolder,
  onFolderChange,
  opencodeModels,
  sourceFolders,
  loadingFolders,
  loadingAnswer,
  sourcesError,
  onSubmit
}: ChatComposerProps) {
  const mobileTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedModelOption = opencodeModels.find((model) => model.id === selectedModel) ?? opencodeModels[0] ?? null;
  const showOpenAiRouteToggle = shouldShowOpenAiRouteToggle(selectedEngine, selectedModel);

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
                      "h-10 min-h-[40px] max-h-[160px] overflow-y-hidden overscroll-contain border-0 px-2 py-[0.5rem] pr-1 text-[16px] leading-5 text-[var(--text-secondary)] shadow-none ring-0 placeholder:text-[var(--text-tertiary)] lg:hidden lg:px-4 lg:text-[18px]",
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
                      "hidden px-2 text-[17px] text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] lg:block lg:px-4 lg:text-[18px]",
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
            <div className="flex flex-wrap items-center gap-3 text-[var(--text-tertiary)]">
              <Select
                value={selectedEngine}
                onValueChange={(value) => onEngineChange(value as "qmd" | "opencode")}
                disabled={loadingAnswer}
              >
                <SelectTrigger
                  className={cn(
                    "linear-pill w-fit max-w-[220px] border-[var(--border-strong)] px-4 py-2 font-[400] shadow-none transition-[width,padding,background-color,border-color,color] duration-300 ease-out",
                    docked ? "chat-composer-pill h-9" : "bg-[var(--bg-page)]"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="min-w-[180px]">
                  <SelectItem value="qmd">QMD</SelectItem>
                  <SelectItem value="opencode">OpenCode</SelectItem>
                </SelectContent>
              </Select>

              {selectedEngine === "opencode" && opencodeModels.length > 0 ? (
                <Select
                  value={selectedModel}
                  onValueChange={(value) => onModelChange(value as OpencodeModelId)}
                  disabled={loadingAnswer}
                >
                  <SelectTrigger
                    className={cn(
                      "linear-pill w-fit max-w-[320px] gap-3 border-[var(--border-strong)] px-4 py-2 font-[400] shadow-none transition-[width,padding,background-color,border-color,color] duration-300 ease-out",
                      docked ? "chat-composer-pill h-9" : "bg-[var(--bg-page)]"
                    )}
                  >
                    <span className="min-w-0 truncate text-left">
                      {selectedModelOption?.label ?? "OpenCode model"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="min-w-[280px]">
                    {opencodeModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex min-w-0 flex-col">
                          <span>{model.label}</span>
                          <span className="text-[12px] leading-[1.4] text-[var(--text-tertiary)]">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {showOpenAiRouteToggle ? (
                <ToggleGroup
                  type="single"
                  value={selectedOpenAiRoute}
                  onValueChange={(value) => {
                    if (value === "subscription" || value === "openrouter") {
                      onOpenAiRouteChange(value);
                    }
                  }}
                  disabled={loadingAnswer}
                  className="h-9 rounded-full bg-[var(--bg-button-subtle)] p-1"
                  aria-label="OpenAI route"
                >
                  <ToggleGroupItem value="subscription" className="h-7">
                    Subscription
                  </ToggleGroupItem>
                  <ToggleGroupItem value="openrouter" className="h-7">
                    OpenRouter
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : null}

              <Select
                value={selectedFolder || "__all__"}
                onValueChange={(value) => onFolderChange(value === "__all__" ? "" : value)}
                disabled={loadingFolders || loadingAnswer}
              >
                <SelectTrigger
                  className={cn(
                    "linear-pill w-fit max-w-[280px] gap-3 border-[var(--border-strong)] px-4 py-2 font-[400] shadow-none transition-[width,padding,background-color,border-color,color] duration-300 ease-out",
                    docked ? "chat-composer-pill h-9" : "bg-[var(--bg-page)]"
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
          selectedEngine={selectedEngine}
          onEngineChange={onEngineChange}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          selectedOpenAiRoute={selectedOpenAiRoute}
          onOpenAiRouteChange={onOpenAiRouteChange}
          selectedFolder={selectedFolder}
          onFolderChange={onFolderChange}
          opencodeModels={opencodeModels}
          sourceFolders={sourceFolders}
          loadingFolders={loadingFolders}
          loadingAnswer={loadingAnswer}
        />
      </form>

      {sourcesError ? <p className="px-1 pt-3 text-[14px] text-[var(--text-tertiary)]">{sourcesError}</p> : null}
    </div>
  );
}
