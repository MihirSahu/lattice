"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessageList } from "@/components/chat-message-list";
import { ChatNavbar } from "@/components/chat-navbar";
import { ChatSidebar } from "@/components/chat-sidebar";
import { LatticeMark } from "@/components/lattice-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset } from "@/components/ui/sidebar";
import {
  OPENCODE_MODEL_IDS,
  askErrorResponseSchema,
  askResponseSchema,
  opencodeModelsResponseSchema,
  sourceFoldersResponseSchema,
  type AskResponse,
  type ChatMessage,
  type ChatThread,
  type OpencodeModelId,
  type OpencodeModelOption,
  type SourceFolder,
  type StoredChatState
} from "@/lib/schemas";

const CHAT_STORAGE_KEY = "lattice-chat-state-v1";
const DEFAULT_THREAD_TITLE = "New chat";
const MAX_STORED_THREADS = 20;
const FALLBACK_OPENCODE_MODEL: OpencodeModelId = "anthropic/claude-sonnet-4.6";

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function truncateTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();

  if (normalized.length <= 52) {
    return normalized;
  }

  return `${normalized.slice(0, 51)}…`;
}

function sortThreads(threads: ChatThread[]) {
  return [...threads].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function clampThreads(threads: ChatThread[]) {
  return sortThreads(threads).slice(0, MAX_STORED_THREADS);
}

function isSupportedOpencodeModel(value: unknown): value is OpencodeModelId {
  return typeof value === "string" && OPENCODE_MODEL_IDS.includes(value as OpencodeModelId);
}

function normalizeOpencodeModel(value: unknown, fallback: OpencodeModelId) {
  return isSupportedOpencodeModel(value) ? value : fallback;
}

function createEmptyThread(): ChatThread {
  const timestamp = new Date().toISOString();

  return {
    id: createId(),
    title: DEFAULT_THREAD_TITLE,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
    engine: "opencode",
    folder: ""
  };
}

function normalizeStoredState(value: unknown): StoredChatState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as StoredChatState;

  if (!Array.isArray(candidate.threads)) {
    return null;
  }

  return {
    activeThreadId: typeof candidate.activeThreadId === "string" ? candidate.activeThreadId : null,
    threads: candidate.threads.filter((thread): thread is ChatThread => {
      return Boolean(
        thread &&
          typeof thread.id === "string" &&
          typeof thread.title === "string" &&
          typeof thread.createdAt === "string" &&
          typeof thread.updatedAt === "string" &&
          typeof thread.engine === "string" &&
          typeof thread.folder === "string" &&
          (thread.model === undefined || typeof thread.model === "string") &&
          Array.isArray(thread.messages)
      );
    })
  };
}

function replaceThread(threads: ChatThread[], threadId: string, updater: (thread: ChatThread) => ChatThread) {
  return clampThreads(threads.map((thread) => (thread.id === threadId ? updater(thread) : thread)));
}

function findActiveThread(threads: ChatThread[], activeThreadId: string | null) {
  return threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null;
}

function createUserMessage(question: string): ChatMessage {
  return {
    id: createId(),
    role: "user",
    createdAt: new Date().toISOString(),
    question
  };
}

function createPendingAssistantMessage(): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    createdAt: new Date().toISOString(),
    pending: true,
    error: null
  };
}

function createAssistantMessage(response: AskResponse): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    createdAt: new Date().toISOString(),
    response,
    error: null
  };
}

function createAssistantErrorMessage(message: string, details?: string[] | null, code?: string | null): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    createdAt: new Date().toISOString(),
    error: message,
    errorDetails: details ?? null,
    errorCode: code ?? null
  };
}

export function QaWorkbench() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [sourceFolders, setSourceFolders] = useState<SourceFolder[]>([]);
  const [opencodeModels, setOpencodeModels] = useState<OpencodeModelOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [navVisible, setNavVisible] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSourceFolders() {
      try {
        const response = await fetch("/api/sources", { cache: "no-store" });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Unable to load source folders.");
        }

        const parsed = sourceFoldersResponseSchema.parse(json);

        if (active) {
          setSourceFolders(parsed.folders);
        }
      } catch (caught) {
        if (active) {
          setSourcesError(caught instanceof Error ? caught.message : "Unable to load source folders.");
        }
      } finally {
        if (active) {
          setLoadingFolders(false);
        }
      }
    }

    void loadSourceFolders();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadOpencodeModels() {
      try {
        const response = await fetch("/api/models", { cache: "no-store" });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Unable to load OpenCode models.");
        }

        const parsed = opencodeModelsResponseSchema.parse(json);

        if (active) {
          setOpencodeModels(parsed.models);
        }
      } catch {
        if (active) {
          setOpencodeModels([]);
        }
      }
    }

    void loadOpencodeModels();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const fallbackThread = createEmptyThread();

    try {
      const storedValue = window.localStorage.getItem(CHAT_STORAGE_KEY);

      if (!storedValue) {
        setThreads([fallbackThread]);
        setActiveThreadId(fallbackThread.id);
        setHydrated(true);
        return;
      }

      const parsedValue = JSON.parse(storedValue);
      const normalized = normalizeStoredState(parsedValue);

      if (!normalized || normalized.threads.length === 0) {
        setThreads([fallbackThread]);
        setActiveThreadId(fallbackThread.id);
        setHydrated(true);
        return;
      }

      const nextThreads = clampThreads(normalized.threads);
      const nextActiveThreadId = nextThreads.some((thread) => thread.id === normalized.activeThreadId)
        ? normalized.activeThreadId
        : nextThreads[0]?.id ?? fallbackThread.id;

      setThreads(nextThreads);
      setActiveThreadId(nextActiveThreadId);
    } catch {
      setThreads([fallbackThread]);
      setActiveThreadId(fallbackThread.id);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const nextThreads = clampThreads(threads);
    const nextActiveThreadId = nextThreads.some((thread) => thread.id === activeThreadId)
      ? activeThreadId
      : nextThreads[0]?.id ?? null;

    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        activeThreadId: nextActiveThreadId,
        threads: nextThreads
      } satisfies StoredChatState)
    );
  }, [activeThreadId, hydrated, threads]);

  const activeThread = useMemo(() => findActiveThread(threads, activeThreadId), [activeThreadId, threads]);
  const isChatMode = Boolean(activeThread && activeThread.messages.length > 0);
  const defaultOpencodeModel = useMemo(
    () => opencodeModels.find((model) => model.isDefault)?.id ?? FALLBACK_OPENCODE_MODEL,
    [opencodeModels]
  );
  const selectedEngine = activeThread?.engine ?? "opencode";
  const selectedFolder = activeThread?.folder ?? "";
  const selectedModel = normalizeOpencodeModel(activeThread?.model, defaultOpencodeModel);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    setThreads((currentThreads) => {
      let changed = false;

      const nextThreads = currentThreads.map((thread) => {
        if (thread.engine !== "opencode") {
          return thread;
        }

        const nextModel = normalizeOpencodeModel(thread.model, defaultOpencodeModel);

        if (thread.model === nextModel) {
          return thread;
        }

        changed = true;
        return {
          ...thread,
          model: nextModel
        };
      });

      return changed ? nextThreads : currentThreads;
    });
  }, [defaultOpencodeModel, hydrated]);

  useEffect(() => {
    if (!isChatMode) {
      setNavVisible(true);
      return;
    }

    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const topThreshold = 18;
    const directionThreshold = 10;
    const bottomThreshold = 20;
    let lastScrollTop = Math.max(0, container.scrollTop);

    const handleScroll = () => {
      const currentScrollTop = Math.max(0, container.scrollTop);
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const distanceFromBottom = maxScrollTop - currentScrollTop;
      const delta = currentScrollTop - lastScrollTop;

      if (Math.abs(delta) < directionThreshold) {
        return;
      }

      if (currentScrollTop <= topThreshold) {
        setNavVisible(true);
        lastScrollTop = currentScrollTop;
        return;
      }

      if (distanceFromBottom <= bottomThreshold) {
        lastScrollTop = currentScrollTop;
        return;
      }

      if (delta < 0) {
        setNavVisible(true);
      } else {
        setNavVisible(false);
      }

      lastScrollTop = currentScrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [activeThreadId, isChatMode]);

  useEffect(() => {
    if (!isChatMode) {
      return;
    }

    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
  }, [activeThread?.messages.length, isChatMode]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileSidebarOpen(false);
        setMobileSettingsOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    if (mediaQuery.matches) {
      setMobileSidebarOpen(false);
      setMobileSettingsOpen(false);
    }

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [hydrated]);

  function handleCreateThread() {
    if (loadingAnswer) {
      return;
    }

    if (activeThread && activeThread.messages.length === 0) {
      setDraftQuestion("");
      setNavVisible(true);
      return;
    }

    const nextThread = createEmptyThread();
    setThreads((currentThreads) => clampThreads([nextThread, ...currentThreads]));
    setActiveThreadId(nextThread.id);
    setDraftQuestion("");
    setNavVisible(true);
  }

  function handleCreateThreadFromSidebar() {
    handleCreateThread();
    setMobileSidebarOpen(false);
  }

  function handleSelectThread(threadId: string) {
    if (loadingAnswer) {
      return;
    }

    setActiveThreadId(threadId);
    setDraftQuestion("");
    setNavVisible(true);
  }

  function handleSelectThreadFromSidebar(threadId: string) {
    handleSelectThread(threadId);
    setMobileSidebarOpen(false);
  }

  function handleEngineChange(value: "qmd" | "opencode") {
    if (!activeThread) {
      return;
    }

    setThreads((currentThreads) =>
      replaceThread(currentThreads, activeThread.id, (thread) => ({
        ...thread,
        engine: value,
        model: value === "opencode" ? normalizeOpencodeModel(thread.model, defaultOpencodeModel) : thread.model
      }))
    );
  }

  function handleModelChange(value: OpencodeModelId) {
    if (!activeThread) {
      return;
    }

    setThreads((currentThreads) =>
      replaceThread(currentThreads, activeThread.id, (thread) => ({
        ...thread,
        model: value
      }))
    );
  }

  function handleFolderChange(value: string) {
    if (!activeThread) {
      return;
    }

    setThreads((currentThreads) =>
      replaceThread(currentThreads, activeThread.id, (thread) => ({
        ...thread,
        folder: value
      }))
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeThread || loadingAnswer) {
      return;
    }

    const trimmedQuestion = draftQuestion.trim();

    if (!trimmedQuestion) {
      return;
    }

    const userMessage = createUserMessage(trimmedQuestion);
    const pendingMessage = createPendingAssistantMessage();
    const submittedThreadId = activeThread.id;
    const submissionTimestamp = new Date().toISOString();

    setDraftQuestion("");
    setLoadingAnswer(true);
    setNavVisible(true);
    setThreads((currentThreads) =>
      replaceThread(currentThreads, submittedThreadId, (thread) => ({
        ...thread,
        title: thread.title === DEFAULT_THREAD_TITLE ? truncateTitle(trimmedQuestion) : thread.title,
        updatedAt: submissionTimestamp,
        messages: [...thread.messages, userMessage, pendingMessage]
      }))
    );

    try {
      const result = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          folder: activeThread.folder || undefined,
          engine: activeThread.engine,
          model: activeThread.engine === "opencode" ? normalizeOpencodeModel(activeThread.model, defaultOpencodeModel) : undefined
        })
      });
      const json = await result.json();

      if (!result.ok) {
        const parsedError = askErrorResponseSchema.safeParse(json);
        const nextErrorMessage = parsedError.success ? parsedError.data.error : json?.error || "Question failed.";
        const nextErrorDetails = parsedError.success ? parsedError.data.details ?? null : null;
        const nextErrorCode = parsedError.success ? parsedError.data.code ?? null : null;

        setThreads((currentThreads) =>
          replaceThread(currentThreads, submittedThreadId, (thread) => ({
            ...thread,
            updatedAt: new Date().toISOString(),
            messages: thread.messages.map((threadMessage) =>
              threadMessage.id === pendingMessage.id
                ? createAssistantErrorMessage(nextErrorMessage, nextErrorDetails, nextErrorCode)
                : threadMessage
            )
          }))
        );
        return;
      }

      const parsed = askResponseSchema.parse(json);

      setThreads((currentThreads) =>
        replaceThread(currentThreads, submittedThreadId, (thread) => ({
          ...thread,
          updatedAt: new Date().toISOString(),
          messages: thread.messages.map((message) =>
            message.id === pendingMessage.id ? createAssistantMessage(parsed) : message
          )
        }))
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Question failed.";

      setThreads((currentThreads) =>
        replaceThread(currentThreads, submittedThreadId, (thread) => ({
          ...thread,
          updatedAt: new Date().toISOString(),
          messages: thread.messages.map((threadMessage) =>
            threadMessage.id === pendingMessage.id ? createAssistantErrorMessage(message) : threadMessage
          )
        }))
      );
    } finally {
      setLoadingAnswer(false);
    }
  }

  if (!hydrated || !activeThread) {
    return <div className="min-h-screen bg-[var(--bg-page)]" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-page)]">
      <ChatSidebar
        activeThreadId={activeThread.id}
        collapsed={sidebarCollapsed}
        disabled={loadingAnswer}
        threads={threads}
        onCreateThread={handleCreateThread}
        onSelectThread={handleSelectThread}
      />

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 lg:hidden" showClose={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
          </SheetHeader>
          <ChatSidebar
            mobile
            activeThreadId={activeThread.id}
            disabled={loadingAnswer}
            threads={threads}
            onCreateThread={handleCreateThreadFromSidebar}
            onSelectThread={handleSelectThreadFromSidebar}
          />
        </SheetContent>
      </Sheet>

      <SidebarInset className="flex min-w-0 flex-1 flex-col">
        {isChatMode ? (
          <>
            <ChatNavbar
              visible={navVisible}
              title={activeThread.title}
              engine={selectedEngine}
              folder={selectedFolder}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
              onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            />

            <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-6 sm:pb-10">
              <ChatMessageList messages={activeThread.messages} />
            </div>

            <div className="chat-composer-dock px-4 pb-3 pt-2 sm:px-6 sm:pb-4">
              <ChatComposer
                docked
                draftQuestion={draftQuestion}
                onDraftQuestionChange={setDraftQuestion}
                selectedEngine={selectedEngine}
                onEngineChange={handleEngineChange}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                mobileSettingsOpen={mobileSettingsOpen}
                onMobileSettingsOpenChange={setMobileSettingsOpen}
                selectedFolder={selectedFolder}
                onFolderChange={handleFolderChange}
                opencodeModels={opencodeModels}
                sourceFolders={sourceFolders}
                loadingFolders={loadingFolders}
                loadingAnswer={loadingAnswer}
                sourcesError={sourcesError}
                onSubmit={handleSubmit}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-screen flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
            <div className="flex w-full justify-start">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                title="Open sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
                <span className="sr-only">Open sidebar</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-10 w-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:inline-flex"
                onClick={() => setSidebarCollapsed((current) => !current)}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                <span className="sr-only">{sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
              </Button>
            </div>

            <div className="mx-auto hidden w-full max-w-[1080px] flex-1 flex-col items-center justify-center lg:flex">
              <div className="mb-8 text-center sm:mb-10">
                <div className="inline-flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] sm:h-12 sm:w-12">
                    <LatticeMark className="h-5 w-5 text-[var(--text-primary)]/90 sm:h-6 sm:w-6" />
                  </div>
                  <h1 className="text-[36px] font-[600] leading-[1.1] tracking-[-0.9px] text-[var(--text-primary)] sm:text-[48px] sm:tracking-[-1.2px]">
                    Lattice
                  </h1>
                </div>
                <p className="mx-auto mt-3 max-w-[560px] text-[16px] font-[400] leading-[1.5] text-[var(--text-tertiary)]">
                  What would you like to know?
                </p>
              </div>

              <ChatComposer
                draftQuestion={draftQuestion}
                onDraftQuestionChange={setDraftQuestion}
                selectedEngine={selectedEngine}
                onEngineChange={handleEngineChange}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                mobileSettingsOpen={mobileSettingsOpen}
                onMobileSettingsOpenChange={setMobileSettingsOpen}
                selectedFolder={selectedFolder}
                onFolderChange={handleFolderChange}
                opencodeModels={opencodeModels}
                sourceFolders={sourceFolders}
                loadingFolders={loadingFolders}
                loadingAnswer={loadingAnswer}
                sourcesError={sourcesError}
                onSubmit={handleSubmit}
              />
            </div>

            <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col lg:hidden">
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <div className="inline-flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      <LatticeMark className="h-5 w-5 text-[var(--text-primary)]/90" />
                    </div>
                    <h1 className="text-[36px] font-[600] leading-[1.1] tracking-[-0.9px] text-[var(--text-primary)] sm:text-[48px] sm:tracking-[-1.2px]">
                      Lattice
                    </h1>
                  </div>
                  <p className="mx-auto mt-3 max-w-[560px] text-[16px] font-[400] leading-[1.5] text-[var(--text-tertiary)]">
                    What would you like to know?
                  </p>
                </div>
              </div>

              <div className="mt-auto pb-1">
                <ChatComposer
                  draftQuestion={draftQuestion}
                  onDraftQuestionChange={setDraftQuestion}
                  selectedEngine={selectedEngine}
                  onEngineChange={handleEngineChange}
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  mobileSettingsOpen={mobileSettingsOpen}
                  onMobileSettingsOpenChange={setMobileSettingsOpen}
                  selectedFolder={selectedFolder}
                  onFolderChange={handleFolderChange}
                  opencodeModels={opencodeModels}
                  sourceFolders={sourceFolders}
                  loadingFolders={loadingFolders}
                  loadingAnswer={loadingAnswer}
                  sourcesError={sourcesError}
                  onSubmit={handleSubmit}
                />
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </div>
  );
}
