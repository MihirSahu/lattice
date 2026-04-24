"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  chatAskResponseSchema,
  chatThreadDetailResponseSchema,
  chatThreadSummaryResponseSchema,
  chatThreadsResponseSchema,
  opencodeModelsResponseSchema,
  sourceFoldersResponseSchema,
  type ChatAskRequest,
  type ChatAskResponse,
  type ChatThreadDetail,
  type ChatThreadSummary,
  type ChatThreadsResponse,
  type OpencodeModelOption,
  type SourceFolder
} from "@/lib/schemas";

type ThreadPatchRequest = {
  threadId: string;
  title?: string;
  engine?: "qmd" | "opencode";
  folder?: string;
  model?: ChatAskRequest["model"] | null;
};

export const chatQueryKeys = {
  sourceFolders: ["source-folders"] as const,
  opencodeModels: ["opencode-models"] as const,
  threadSummaries: ["chat", "threads"] as const,
  threadDetail: (threadId: string) => ["chat", "threads", threadId] as const
};

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function fetchJson<T>(input: RequestInfo, init: RequestInit, parse: (value: unknown) => T): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init
  });
  const json = await response.json();

  if (!response.ok) {
    const message = typeof json?.error === "string" ? json.error : "Request failed.";
    throw new HttpError(message, response.status);
  }

  return parse(json);
}

async function listThreadSummaries(): Promise<ChatThreadsResponse> {
  return fetchJson("/api/chat/threads", { method: "GET" }, (json) => chatThreadsResponseSchema.parse(json));
}

async function getThreadDetail(threadId: string): Promise<ChatThreadDetail> {
  return fetchJson(`/api/chat/threads/${threadId}`, { method: "GET" }, (json) => chatThreadDetailResponseSchema.parse(json).thread);
}

async function updateThreadSettings(request: ThreadPatchRequest): Promise<ChatThreadSummary> {
  return fetchJson(
    `/api/chat/threads/${request.threadId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: request.title,
        engine: request.engine,
        folder: request.folder,
        model: request.model
      })
    },
    (json) => chatThreadSummaryResponseSchema.parse(json).thread
  );
}

async function askChat(request: ChatAskRequest): Promise<ChatAskResponse> {
  return fetchJson(
    "/api/chat/ask",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    },
    (json) => chatAskResponseSchema.parse(json)
  );
}

async function getSourceFolders(): Promise<SourceFolder[]> {
  return fetchJson("/api/sources", { method: "GET" }, (json) => sourceFoldersResponseSchema.parse(json).folders);
}

async function getOpencodeModels(): Promise<OpencodeModelOption[]> {
  return fetchJson("/api/models", { method: "GET" }, (json) => opencodeModelsResponseSchema.parse(json).models);
}

export function useSourceFoldersQuery(initialData?: SourceFolder[]) {
  return useQuery<SourceFolder[]>({
    queryKey: chatQueryKeys.sourceFolders,
    queryFn: getSourceFolders,
    initialData
  });
}

export function useOpencodeModelsQuery(initialData?: OpencodeModelOption[]) {
  return useQuery<OpencodeModelOption[]>({
    queryKey: chatQueryKeys.opencodeModels,
    queryFn: getOpencodeModels,
    initialData
  });
}

export function useThreadSummariesQuery(initialData?: ChatThreadsResponse) {
  return useQuery<ChatThreadsResponse>({
    queryKey: chatQueryKeys.threadSummaries,
    queryFn: listThreadSummaries,
    initialData
  });
}

export function useThreadDetailQuery(threadId: string | null, initialData?: ChatThreadDetail) {
  return useQuery<ChatThreadDetail>({
    queryKey: threadId ? chatQueryKeys.threadDetail(threadId) : ["chat", "threads", "draft"],
    queryFn: () => getThreadDetail(threadId as string),
    enabled: Boolean(threadId),
    initialData
  });
}

export function useAskChatMutation() {
  return useMutation<ChatAskResponse, Error, ChatAskRequest>({
    mutationFn: askChat
  });
}

export function useUpdateThreadSettingsMutation() {
  return useMutation<ChatThreadSummary, Error, ThreadPatchRequest>({
    mutationFn: updateThreadSettings
  });
}
