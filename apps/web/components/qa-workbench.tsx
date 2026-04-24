"use client";

import { useQueryClient } from "@tanstack/react-query";
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
  chatQueryKeys,
  HttpError,
  useAskChatMutation,
  useOpencodeModelsQuery,
  useSourceFoldersQuery,
  useThreadDetailQuery,
  useThreadSummariesQuery,
  useUpdateThreadSettingsMutation
} from "@/lib/chat-hooks";
import {
  FALLBACK_OPENCODE_MODEL,
  createDraftThreadSettings,
  DEFAULT_THREAD_TITLE,
  loadLocalChatCache,
  loadLocalChatUiState,
  saveLocalChatCache,
  saveLocalChatUiState,
  toDisplayMessages,
  type PendingAskOverlay
} from "@/lib/chat-local-state";
import {
  OPENCODE_MODEL_IDS,
  type ChatThreadDetail,
  type ChatThreadSummary,
  type DraftThreadSettings,
  type OpencodeModelId
} from "@/lib/schemas";

function isSupportedOpencodeModel(value: unknown): value is OpencodeModelId {
  return typeof value === "string" && OPENCODE_MODEL_IDS.includes(value as OpencodeModelId);
}

function normalizeOpencodeModel(value: unknown, fallback: OpencodeModelId) {
  return isSupportedOpencodeModel(value) ? value : fallback;
}

function toThreadSummary(thread: ChatThreadDetail): ChatThreadSummary {
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    engine: thread.engine,
    folder: thread.folder,
    model: thread.model ?? null
  };
}

function upsertThreadSummary(summaries: ChatThreadSummary[] | undefined, nextSummary: ChatThreadSummary) {
  const currentSummaries = summaries ?? [];
  const existingIndex = currentSummaries.findIndex((summary) => summary.id === nextSummary.id);
  const nextSummaries = [...currentSummaries];

  if (existingIndex >= 0) {
    nextSummaries[existingIndex] = nextSummary;
  } else {
    nextSummaries.unshift(nextSummary);
  }

  return nextSummaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function getPendingOverlayForThread(selectedThreadId: string | null, pendingAsk: PendingAskOverlay | null) {
  if (!pendingAsk) {
    return null;
  }

  if (selectedThreadId === null) {
    return pendingAsk.threadId === null ? pendingAsk : null;
  }

  return pendingAsk.threadId === selectedThreadId ? pendingAsk : null;
}

function getUnauthorizedError(error: unknown) {
  return error instanceof HttpError && error.status === 401 ? error : null;
}

export function QaWorkbench() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hydratedUserEmailRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const [authenticatedUserEmail, setAuthenticatedUserEmail] = useState<string | null>(null);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draftThreadSettings, setDraftThreadSettings] = useState<DraftThreadSettings>(createDraftThreadSettings());
  const [pendingAsk, setPendingAsk] = useState<PendingAskOverlay | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);

  const sourceFoldersQuery = useSourceFoldersQuery();
  const opencodeModelsQuery = useOpencodeModelsQuery();
  const threadSummariesQuery = useThreadSummariesQuery();
  const threadDetailQuery = useThreadDetailQuery(selectedThreadId);
  const askMutation = useAskChatMutation();
  const updateThreadSettingsMutation = useUpdateThreadSettingsMutation();

  const liveUserEmail = threadSummariesQuery.data?.userEmail ?? null;
  const userChanged = Boolean(authenticatedUserEmail && liveUserEmail && authenticatedUserEmail !== liveUserEmail);
  const threadSummaries = threadSummariesQuery.data?.threads ?? [];
  const activeThread = !userChanged && selectedThreadId ? threadDetailQuery.data ?? null : null;
  const loadingFolders = sourceFoldersQuery.isLoading && !sourceFoldersQuery.data;
  const sourceFolders = sourceFoldersQuery.data ?? [];
  const sourcesError = sourceFoldersQuery.error instanceof Error ? sourceFoldersQuery.error.message : null;
  const opencodeModels = opencodeModelsQuery.data ?? [];
  const defaultOpencodeModel = useMemo(
    () => opencodeModels.find((model) => model.isDefault)?.id ?? FALLBACK_OPENCODE_MODEL,
    [opencodeModels]
  );
  const interactionDisabled = askMutation.isPending || updateThreadSettingsMutation.isPending;

  useEffect(() => {
    setDraftThreadSettings((current) => ({
      ...current,
      model: normalizeOpencodeModel(current.model, defaultOpencodeModel)
    }));
  }, [defaultOpencodeModel]);

  useEffect(() => {
    if (!liveUserEmail) {
      return;
    }

    setAuthenticatedUserEmail((current) => (current === liveUserEmail ? current : liveUserEmail));
  }, [liveUserEmail]);

  useEffect(() => {
    if (!authenticatedUserEmail || hydratedUserEmailRef.current === authenticatedUserEmail) {
      return;
    }

    const savedUiState = loadLocalChatUiState(authenticatedUserEmail, defaultOpencodeModel);
    const savedCache = loadLocalChatCache(authenticatedUserEmail);

    if (savedCache?.lastThreadDetail) {
      queryClient.setQueryData(chatQueryKeys.threadDetail(savedCache.lastThreadDetail.id), savedCache.lastThreadDetail);
    }

    setSelectedThreadId(savedUiState.selectedThreadId);
    setDraftQuestion(savedUiState.draftQuestion);
    setDraftThreadSettings(savedUiState.draftThreadSettings);
    setSidebarCollapsed(savedUiState.sidebarCollapsed);
    setPendingAsk(null);
    setRequestError(null);
    hydratedUserEmailRef.current = authenticatedUserEmail;
  }, [authenticatedUserEmail, defaultOpencodeModel, queryClient]);

  useEffect(() => {
    if (selectedThreadId && threadSummariesQuery.data && !threadSummaries.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threadSummaries[0]?.id ?? null);
    }
  }, [selectedThreadId, threadSummaries, threadSummariesQuery.data]);

  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }

    if (!(threadDetailQuery.error instanceof HttpError) || threadDetailQuery.error.status !== 404) {
      return;
    }

    setSelectedThreadId(null);
    setRequestError("The selected chat is not available for the current user. Start a new chat or resend your message.");
    queryClient.setQueryData(chatQueryKeys.threadSummaries, (current: typeof threadSummariesQuery.data | undefined) =>
      current
        ? {
            ...current,
            threads: current.threads.filter((thread) => thread.id !== selectedThreadId)
          }
        : current
    );
    queryClient.removeQueries({ queryKey: chatQueryKeys.threadDetail(selectedThreadId) });
  }, [queryClient, selectedThreadId, threadDetailQuery.error]);

  useEffect(() => {
    if (
      !authenticatedUserEmail ||
      hydratedUserEmailRef.current !== authenticatedUserEmail ||
      (liveUserEmail !== null && liveUserEmail !== authenticatedUserEmail)
    ) {
      return;
    }

    saveLocalChatUiState(authenticatedUserEmail, {
      selectedThreadId,
      draftQuestion,
      draftThreadSettings,
      sidebarCollapsed
    });
  }, [authenticatedUserEmail, draftQuestion, draftThreadSettings, liveUserEmail, selectedThreadId, sidebarCollapsed]);

  useEffect(() => {
    if (
      !authenticatedUserEmail ||
      hydratedUserEmailRef.current !== authenticatedUserEmail ||
      (liveUserEmail !== null && liveUserEmail !== authenticatedUserEmail) ||
      (!threadSummariesQuery.data && !threadDetailQuery.data)
    ) {
      return;
    }

    saveLocalChatCache(authenticatedUserEmail, {
      threadSummaries,
      lastThreadDetail: threadDetailQuery.data ?? null,
      cachedAt: new Date().toISOString()
    });
  }, [authenticatedUserEmail, liveUserEmail, threadDetailQuery.data, threadSummaries, threadSummariesQuery.data]);

  const selectedEngine = activeThread?.engine ?? draftThreadSettings.engine;
  const selectedFolder = activeThread?.folder ?? draftThreadSettings.folder;
  const selectedModel = normalizeOpencodeModel(activeThread?.model ?? draftThreadSettings.model, defaultOpencodeModel);
  const visibleMessages = toDisplayMessages(activeThread?.messages ?? [], getPendingOverlayForThread(selectedThreadId, pendingAsk));
  const isChatMode = visibleMessages.length > 0;
  const unauthorizedQueryError = getUnauthorizedError(threadSummariesQuery.error) ?? getUnauthorizedError(threadDetailQuery.error);
  const offlineCachedHistory =
    Boolean(authenticatedUserEmail) &&
    !unauthorizedQueryError &&
    (threadSummariesQuery.isError || (selectedThreadId !== null && threadDetailQuery.isError)) &&
    (threadSummaries.length > 0 || Boolean(threadDetailQuery.data));

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

      setNavVisible(delta < 0);
      lastScrollTop = currentScrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isChatMode, selectedThreadId]);

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
  }, [isChatMode, visibleMessages.length]);

  useEffect(() => {
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
  }, []);

  function handleCreateThread() {
    if (interactionDisabled) {
      return;
    }

    setSelectedThreadId(null);
    setDraftQuestion("");
    setNavVisible(true);
    setRequestError(null);
  }

  function handleSelectThread(threadId: string) {
    if (interactionDisabled) {
      return;
    }

    setSelectedThreadId(threadId);
    setDraftQuestion("");
    setNavVisible(true);
    setRequestError(null);
  }

  function applyThreadCaches(thread: ChatThreadDetail) {
    const summary = toThreadSummary(thread);

    queryClient.setQueryData(chatQueryKeys.threadDetail(thread.id), thread);
    queryClient.setQueryData(chatQueryKeys.threadSummaries, (current: typeof threadSummariesQuery.data | undefined) =>
      current
        ? {
            ...current,
            threads: upsertThreadSummary(current.threads, summary)
          }
        : current
    );
  }

  function handleThreadSettingsPatch(patch: {
    engine?: "qmd" | "opencode";
    folder?: string;
    model?: OpencodeModelId | null;
  }) {
    if (!activeThread || interactionDisabled) {
      return;
    }

    setRequestError(null);

    updateThreadSettingsMutation.mutate(
      {
        threadId: activeThread.id,
        ...patch
      },
      {
        onSuccess: (thread) => {
          queryClient.setQueryData(chatQueryKeys.threadSummaries, (current: typeof threadSummariesQuery.data | undefined) =>
            current
              ? {
                  ...current,
                  threads: upsertThreadSummary(current.threads, thread)
                }
              : current
          );
          queryClient.setQueryData(chatQueryKeys.threadDetail(thread.id), (current: ChatThreadDetail | undefined) =>
            current
              ? {
                  ...current,
                  engine: thread.engine,
                  folder: thread.folder,
                  model: thread.model ?? null,
                  title: thread.title,
                  updatedAt: thread.updatedAt
                }
              : current
          );
        },
        onError: (error) => {
          setRequestError(error instanceof Error ? error.message : "Unable to update chat settings.");
        }
      }
    );
  }

  function handleEngineChange(value: "qmd" | "opencode") {
    if (activeThread) {
      handleThreadSettingsPatch({
        engine: value,
        model: value === "opencode" ? selectedModel : null
      });
      return;
    }

    setDraftThreadSettings((current) => ({
      ...current,
      engine: value,
      model: value === "opencode" ? normalizeOpencodeModel(current.model, defaultOpencodeModel) : current.model
    }));
  }

  function handleModelChange(value: OpencodeModelId) {
    if (activeThread) {
      handleThreadSettingsPatch({
        model: value
      });
      return;
    }

    setDraftThreadSettings((current) => ({
      ...current,
      model: value
    }));
  }

  function handleFolderChange(value: string) {
    if (activeThread) {
      handleThreadSettingsPatch({
        folder: value
      });
      return;
    }

    setDraftThreadSettings((current) => ({
      ...current,
      folder: value
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (interactionDisabled) {
      return;
    }

    const trimmedQuestion = draftQuestion.trim();

    if (!trimmedQuestion) {
      return;
    }

    const submittedQuestion = trimmedQuestion;
    const overlay = {
      threadId: activeThread?.id ?? null,
      question: submittedQuestion,
      createdAt: new Date().toISOString()
    } satisfies PendingAskOverlay;

    setRequestError(null);
    setDraftQuestion("");
    setPendingAsk(overlay);
    setNavVisible(true);

    askMutation.mutate(
      {
        threadId: activeThread?.id,
        question: submittedQuestion,
        engine: selectedEngine,
        folder: selectedFolder || undefined,
        model: selectedEngine === "opencode" ? selectedModel : undefined
      },
      {
        onSuccess: (response) => {
          setPendingAsk(null);
          setSelectedThreadId(response.thread.id);
          applyThreadCaches(response.thread);
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.threadSummaries });
        },
        onError: (error) => {
          setPendingAsk(null);
          setDraftQuestion(submittedQuestion);

          if (error instanceof HttpError && error.status === 404 && activeThread?.id) {
            setSelectedThreadId(null);
            setRequestError("That chat is not available for the current user anymore. Your message is still in the composer.");
            queryClient.setQueryData(chatQueryKeys.threadSummaries, (current: typeof threadSummariesQuery.data | undefined) =>
              current
                ? {
                    ...current,
                    threads: current.threads.filter((thread) => thread.id !== activeThread.id)
                  }
                : current
            );
            queryClient.removeQueries({ queryKey: chatQueryKeys.threadDetail(activeThread.id) });
            return;
          }

          setRequestError(error instanceof Error ? error.message : "Unable to persist chat turn.");
        }
      }
    );
  }

  const topNotice = requestError
    ? { tone: "error", message: requestError }
    : unauthorizedQueryError
      ? { tone: "error", message: unauthorizedQueryError.message }
    : offlineCachedHistory
      ? { tone: "info", message: "Showing offline cached history. Remote chat data could not be refreshed." }
      : null;

  const composer = (
    <ChatComposer
      docked={isChatMode}
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
      loadingAnswer={askMutation.isPending}
      sourcesError={sourcesError}
      onSubmit={handleSubmit}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-page)]">
      <ChatSidebar
        activeThreadId={selectedThreadId}
        collapsed={sidebarCollapsed}
        draftThreadSettings={draftThreadSettings}
        disabled={interactionDisabled}
        threads={threadSummaries}
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
            activeThreadId={selectedThreadId}
            draftThreadSettings={draftThreadSettings}
            disabled={interactionDisabled}
            threads={threadSummaries}
            onCreateThread={() => {
              handleCreateThread();
              setMobileSidebarOpen(false);
            }}
            onSelectThread={(threadId) => {
              handleSelectThread(threadId);
              setMobileSidebarOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <SidebarInset className="flex min-w-0 flex-1 flex-col">
        {isChatMode ? (
          <>
            <ChatNavbar
              visible={navVisible}
              title={activeThread?.title ?? DEFAULT_THREAD_TITLE}
              engine={selectedEngine}
              folder={selectedFolder}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
              onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            />

            <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-6 sm:pb-10">
              {topNotice ? (
                <div
                  className={`mb-4 rounded-2xl border px-4 py-3 text-[13px] leading-[1.6] ${
                    topNotice.tone === "error"
                      ? "border-[rgba(196,92,71,0.25)] bg-[var(--bg-panel)] text-[var(--text-secondary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {topNotice.message}
                </div>
              ) : null}
              <ChatMessageList messages={visibleMessages} />
            </div>

            <div className="chat-composer-dock px-4 pb-3 pt-2 sm:px-6 sm:pb-4">{composer}</div>
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

              {topNotice ? (
                <div
                  className={`mb-4 w-full max-w-[1040px] rounded-2xl border px-4 py-3 text-[13px] leading-[1.6] ${
                    topNotice.tone === "error"
                      ? "border-[rgba(196,92,71,0.25)] bg-[var(--bg-panel)] text-[var(--text-secondary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {topNotice.message}
                </div>
              ) : null}

              {composer}
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

              {topNotice ? (
                <div
                  className={`mb-4 rounded-2xl border px-4 py-3 text-[13px] leading-[1.6] ${
                    topNotice.tone === "error"
                      ? "border-[rgba(196,92,71,0.25)] bg-[var(--bg-panel)] text-[var(--text-secondary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {topNotice.message}
                </div>
              ) : null}

              <div className="mt-auto pb-1">{composer}</div>
            </div>
          </div>
        )}
      </SidebarInset>
    </div>
  );
}
