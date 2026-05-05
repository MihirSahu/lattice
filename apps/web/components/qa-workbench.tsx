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
import { applyStreamEventToState, createPendingAssistantStreamState } from "@/lib/chat-trace";
import {
  FALLBACK_OPENCODE_MODEL,
  createDraftThreadSettings,
  DEFAULT_THREAD_TITLE,
  isLegacyDefaultOpencodeModel,
  isOpenAiOpencodeModel,
  loadLocalChatCache,
  loadLocalChatUiState,
  normalizeOpenAiRoute,
  normalizeOpencodeModel,
  saveLocalChatCache,
  saveLocalChatUiState,
  toDisplayMessages,
  type PendingAskOverlay,
  type ResolvedAssistantStreams
} from "@/lib/chat-local-state";
import {
  type ChatThreadDetail,
  type ChatThreadSummary,
  type DraftThreadSettings,
  type OpencodeOpenAiRoute,
  type OpencodeModelId,
  type PendingAssistantStreamState
} from "@/lib/schemas";

function toThreadSummary(thread: ChatThreadDetail): ChatThreadSummary {
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    engine: thread.engine,
    folder: thread.folder,
    model: thread.model ?? null,
    openAiRoute: thread.openAiRoute ?? null
  };
}

function getLastAssistantMessageId(thread: ChatThreadDetail) {
  return [...thread.messages].reverse().find((message) => message.role === "assistant")?.id ?? null;
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
  const rootShellRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hydratedUserEmailRef = useRef<string | null>(null);
  const pendingStreamRef = useRef<PendingAssistantStreamState | null>(null);
  const queryClient = useQueryClient();
  const [authenticatedUserEmail, setAuthenticatedUserEmail] = useState<string | null>(null);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draftThreadSettings, setDraftThreadSettings] = useState<DraftThreadSettings>(createDraftThreadSettings());
  const [pendingAsk, setPendingAsk] = useState<PendingAskOverlay | null>(null);
  const [resolvedStreams, setResolvedStreams] = useState<ResolvedAssistantStreams>({});
  const [navVisible, setNavVisible] = useState(true);
  const [desktopViewport, setDesktopViewport] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [explicitLegacyDraftModel, setExplicitLegacyDraftModel] = useState(false);
  const [explicitLegacyThreadModels, setExplicitLegacyThreadModels] = useState<Set<string>>(() => new Set());

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
      model: normalizeOpencodeModel(current.model, defaultOpencodeModel, {
        upgradeLegacyDefault: !explicitLegacyDraftModel
      }),
      openAiRoute: normalizeOpenAiRoute(current.openAiRoute, current.model)
    }));
  }, [defaultOpencodeModel, explicitLegacyDraftModel]);

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
    setExplicitLegacyDraftModel(false);
    setExplicitLegacyThreadModels(new Set());
    setSidebarCollapsed(savedUiState.sidebarCollapsed);
    setPendingAsk(null);
    pendingStreamRef.current = null;
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
  const selectedModel = normalizeOpencodeModel(activeThread?.model ?? draftThreadSettings.model, defaultOpencodeModel, {
    upgradeLegacyDefault: activeThread ? !explicitLegacyThreadModels.has(activeThread.id) : !explicitLegacyDraftModel
  });
  const selectedOpenAiRoute = normalizeOpenAiRoute(
    activeThread?.openAiRoute ?? draftThreadSettings.openAiRoute,
    selectedModel
  );
  const visibleMessages = toDisplayMessages(activeThread?.messages ?? [], getPendingOverlayForThread(selectedThreadId, pendingAsk), resolvedStreams);
  const isChatMode = visibleMessages.length > 0;
  const unauthorizedQueryError = getUnauthorizedError(threadSummariesQuery.error) ?? getUnauthorizedError(threadDetailQuery.error);
  const offlineCachedHistory =
    Boolean(authenticatedUserEmail) &&
    !unauthorizedQueryError &&
    (threadSummariesQuery.isError || (selectedThreadId !== null && threadDetailQuery.isError)) &&
    (threadSummaries.length > 0 || Boolean(threadDetailQuery.data));

  useEffect(() => {
    if (!isChatMode || !desktopViewport) {
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
  }, [desktopViewport, isChatMode, selectedThreadId]);

  useEffect(() => {
    if (!isChatMode) {
      return;
    }

    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: desktopViewport ? "smooth" : "auto" });
    });
  }, [desktopViewport, isChatMode, visibleMessages.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setDesktopViewport(event.matches);

      if (event.matches) {
        setMobileSidebarOpen(false);
        setMobileSettingsOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    setDesktopViewport(mediaQuery.matches);

    if (mediaQuery.matches) {
      setMobileSidebarOpen(false);
      setMobileSettingsOpen(false);
    }

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const root = document.documentElement;
    const body = document.body;
    let savedStyles: {
      rootHeight: string;
      rootOverflow: string;
      rootOverscrollBehavior: string;
      bodyHeight: string;
      bodyLeft: string;
      bodyOverflow: string;
      bodyOverscrollBehavior: string;
      bodyPosition: string;
      bodyRight: string;
      bodyTop: string;
      bodyWidth: string;
      scrollY: number;
    } | null = null;

    const restoreScroll = () => {
      if (!savedStyles) {
        return;
      }

      root.style.height = savedStyles.rootHeight;
      root.style.overflow = savedStyles.rootOverflow;
      root.style.overscrollBehavior = savedStyles.rootOverscrollBehavior;
      body.style.height = savedStyles.bodyHeight;
      body.style.left = savedStyles.bodyLeft;
      body.style.overflow = savedStyles.bodyOverflow;
      body.style.overscrollBehavior = savedStyles.bodyOverscrollBehavior;
      body.style.position = savedStyles.bodyPosition;
      body.style.right = savedStyles.bodyRight;
      body.style.top = savedStyles.bodyTop;
      body.style.width = savedStyles.bodyWidth;
      window.scrollTo(0, savedStyles.scrollY);
      savedStyles = null;
    };

    const lockMobileScroll = () => {
      if (mediaQuery.matches) {
        restoreScroll();
        return;
      }

      if (!savedStyles) {
        savedStyles = {
          rootHeight: root.style.height,
          rootOverflow: root.style.overflow,
          rootOverscrollBehavior: root.style.overscrollBehavior,
          bodyHeight: body.style.height,
          bodyLeft: body.style.left,
          bodyOverflow: body.style.overflow,
          bodyOverscrollBehavior: body.style.overscrollBehavior,
          bodyPosition: body.style.position,
          bodyRight: body.style.right,
          bodyTop: body.style.top,
          bodyWidth: body.style.width,
          scrollY: window.scrollY
        };
      }

      root.style.height = "100%";
      root.style.overflow = "hidden";
      root.style.overscrollBehavior = "none";
      body.style.height = "100%";
      body.style.left = "0";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      body.style.position = "fixed";
      body.style.right = "0";
      body.style.top = `-${savedStyles.scrollY}px`;
      body.style.width = "100%";
    };

    lockMobileScroll();
    mediaQuery.addEventListener("change", lockMobileScroll);

    return () => {
      mediaQuery.removeEventListener("change", lockMobileScroll);
      restoreScroll();
    };
  }, []);

  useEffect(() => {
    const root = rootShellRef.current;
    const visualViewport = window.visualViewport;

    if (!root || !visualViewport) {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    let animationFrame: number | null = null;

    const clearViewportVars = () => {
      root.style.removeProperty("--mobile-visual-viewport-height");
      root.style.removeProperty("--mobile-visual-viewport-top");
    };

    const syncVisualViewport = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;

        if (mediaQuery.matches) {
          clearViewportVars();
          return;
        }

        root.style.setProperty("--mobile-visual-viewport-height", `${visualViewport.height}px`);
        root.style.setProperty("--mobile-visual-viewport-top", `${visualViewport.offsetTop}px`);
      });
    };

    const handleDesktopChange = () => {
      syncVisualViewport();
    };

    syncVisualViewport();
    visualViewport.addEventListener("resize", syncVisualViewport);
    visualViewport.addEventListener("scroll", syncVisualViewport);
    mediaQuery.addEventListener("change", handleDesktopChange);

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      visualViewport.removeEventListener("resize", syncVisualViewport);
      visualViewport.removeEventListener("scroll", syncVisualViewport);
      mediaQuery.removeEventListener("change", handleDesktopChange);
      clearViewportVars();
    };
  }, []);

  function handleCreateThread() {
    if (interactionDisabled) {
      return;
    }

    setSelectedThreadId(null);
    setDraftQuestion("");
    setNavVisible(true);
    pendingStreamRef.current = null;
    setExplicitLegacyDraftModel(false);
    setRequestError(null);
  }

  function handleSelectThread(threadId: string) {
    if (interactionDisabled) {
      return;
    }

    setSelectedThreadId(threadId);
    setDraftQuestion("");
    setNavVisible(true);
    pendingStreamRef.current = null;
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
    openAiRoute?: OpencodeOpenAiRoute | null;
  }) {
    if (!activeThread || interactionDisabled) {
      return;
    }

    setRequestError(null);
    const nextModel = patch.model === undefined ? activeThread.model : patch.model;
    const normalizedPatch = {
      ...patch,
      ...(activeThread.engine === "opencode" &&
      patch.model === undefined &&
      !explicitLegacyThreadModels.has(activeThread.id) &&
      isLegacyDefaultOpencodeModel(activeThread.model)
        ? {
            model: defaultOpencodeModel
          }
        : {}),
      ...(patch.openAiRoute === undefined && isOpenAiOpencodeModel(nextModel)
        ? {
            openAiRoute: selectedOpenAiRoute
          }
        : {})
    };

    updateThreadSettingsMutation.mutate(
      {
        threadId: activeThread.id,
        ...normalizedPatch
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
                  openAiRoute: thread.openAiRoute ?? null,
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
        model: value === "opencode" ? selectedModel : null,
        openAiRoute: value === "opencode" && isOpenAiOpencodeModel(selectedModel) ? selectedOpenAiRoute : null
      });
      return;
    }

    setDraftThreadSettings((current) => ({
      ...current,
      engine: value,
      model:
        value === "opencode"
          ? normalizeOpencodeModel(current.model, defaultOpencodeModel, {
              upgradeLegacyDefault: !explicitLegacyDraftModel
            })
          : current.model
    }));
  }

  function handleModelChange(value: OpencodeModelId) {
    const nextOpenAiRoute = isOpenAiOpencodeModel(value) ? selectedOpenAiRoute : null;

    if (activeThread) {
      setExplicitLegacyThreadModels((current) => {
        const next = new Set(current);

        if (isLegacyDefaultOpencodeModel(value)) {
          next.add(activeThread.id);
        } else {
          next.delete(activeThread.id);
        }

        return next;
      });
      handleThreadSettingsPatch({
        model: value,
        openAiRoute: nextOpenAiRoute
      });
      return;
    }

    setExplicitLegacyDraftModel(isLegacyDefaultOpencodeModel(value));
    setDraftThreadSettings((current) => ({
      ...current,
      model: value,
      openAiRoute: isOpenAiOpencodeModel(value) ? normalizeOpenAiRoute(current.openAiRoute, value) : current.openAiRoute
    }));
  }

  function handleOpenAiRouteChange(value: OpencodeOpenAiRoute) {
    if (!isOpenAiOpencodeModel(selectedModel)) {
      return;
    }

    if (activeThread) {
      handleThreadSettingsPatch({
        openAiRoute: value
      });
      return;
    }

    setDraftThreadSettings((current) => ({
      ...current,
      openAiRoute: value
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
      createdAt: new Date().toISOString(),
      stream: createPendingAssistantStreamState()
    } satisfies PendingAskOverlay;

    setRequestError(null);
    setDraftQuestion("");
    pendingStreamRef.current = overlay.stream;
    setPendingAsk(overlay);
    setNavVisible(true);

    askMutation.mutate(
      {
        threadId: activeThread?.id,
        question: submittedQuestion,
        engine: selectedEngine,
        folder: selectedFolder || undefined,
        model: selectedEngine === "opencode" ? selectedModel : undefined,
        openAiRoute: selectedEngine === "opencode" && isOpenAiOpencodeModel(selectedModel) ? selectedOpenAiRoute : undefined,
        onStreamEvent: (event) => {
          setPendingAsk((current) => {
            if (!current || current.createdAt !== overlay.createdAt) {
              return current;
            }

            const nextStream = applyStreamEventToState(current.stream, event);
            pendingStreamRef.current = nextStream;

            return {
              ...current,
              stream: nextStream
            };
          });
        }
      },
      {
        onSuccess: (response) => {
          const finalStream = pendingStreamRef.current
            ? {
                ...pendingStreamRef.current,
                activeTool: null
              }
            : null;
          const assistantMessageId = getLastAssistantMessageId(response.thread);

          if (finalStream && assistantMessageId) {
            setResolvedStreams((current) => ({
              ...current,
              [assistantMessageId]: finalStream
            }));
          }

          pendingStreamRef.current = null;
          setPendingAsk(null);
          setSelectedThreadId(response.thread.id);
          applyThreadCaches(response.thread);
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.threadSummaries });
        },
        onError: (error) => {
          pendingStreamRef.current = null;
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
      selectedOpenAiRoute={selectedOpenAiRoute}
      onOpenAiRouteChange={handleOpenAiRouteChange}
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
    <div
      ref={rootShellRef}
      className="fixed inset-x-0 top-[var(--mobile-visual-viewport-top,0px)] flex h-[var(--mobile-visual-viewport-height,100dvh)] overflow-hidden bg-[var(--bg-page)] lg:static lg:h-screen"
    >
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

      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col">
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

            <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-10 pt-5 sm:px-6 sm:pb-12 lg:pb-10">
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

            <div className="chat-composer-dock px-4 pb-2 pt-2 sm:px-6 lg:pb-4">
              {composer}
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:h-auto lg:min-h-screen lg:overflow-visible">
            <div className="flex w-full shrink-0 justify-start">
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

            <div className="mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 flex-col overflow-hidden lg:hidden">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden py-4 text-center">
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
                  className={`mb-4 shrink-0 rounded-2xl border px-4 py-3 text-[13px] leading-[1.6] ${
                    topNotice.tone === "error"
                      ? "border-[rgba(196,92,71,0.25)] bg-[var(--bg-panel)] text-[var(--text-secondary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {topNotice.message}
                </div>
              ) : null}

              <div className="shrink-0 pb-2">{composer}</div>
            </div>
          </div>
        )}
      </SidebarInset>
    </div>
  );
}
