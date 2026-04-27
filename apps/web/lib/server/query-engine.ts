import { randomUUID } from "node:crypto";
import { parseQueryEngineStreamEvent, readNdjsonStream, type OpenCodeTraceEvent } from "@/lib/chat-stream";
import { config } from "@/lib/config";
import { resolveQueryLimit } from "@/lib/server/query-engine-utils";
import {
  askErrorResponseSchema,
  askResponseSchema,
  type AskErrorResponse,
  type AskResponse,
  type ChatAskRequest
} from "@/lib/schemas";

type QueryEngineSuccess = {
  ok: true;
  status: number;
  response: AskResponse;
};

type QueryEngineError = {
  ok: false;
  status: number;
  error: AskErrorResponse;
};

export type QueryEngineResult = QueryEngineSuccess | QueryEngineError;

type ExecuteQueryEngineOptions = {
  onEvent?: (event: OpenCodeTraceEvent) => void;
};

function previewQuestion(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 119)}…`;
}

export async function executeQueryEngineRequest(
  input: Pick<ChatAskRequest, "engine" | "folder" | "model" | "question"> & {
    openAiRoute?: ChatAskRequest["openAiRoute"];
    limit?: number;
  },
  options: ExecuteQueryEngineOptions = {}
): Promise<QueryEngineResult> {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const serviceUrl = input.engine === "opencode" ? config.opencodeServiceUrl : config.qmdServiceUrl;
  const effectiveLimit = resolveQueryLimit(input.limit, config.defaultQueryLimit);

  console.log(
    `[ask:${requestId}] start engine=${input.engine} folder=${input.folder || "<all>"} limit=${effectiveLimit} question="${previewQuestion(input.question)}"`
  );

  try {
    options.onEvent?.({ type: "status", message: `Starting ${input.engine === "opencode" ? "OpenCode" : "QMD"} query.` });

    const response = await fetch(`${serviceUrl}/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: options.onEvent && input.engine === "opencode" ? "application/x-ndjson" : "application/json",
        "x-request-id": requestId
      },
      body: JSON.stringify({
        question: input.question,
        folder: input.folder || undefined,
        model: input.engine === "opencode" ? input.model : undefined,
        openAiRoute: input.engine === "opencode" ? input.openAiRoute : undefined,
        limit: effectiveLimit
      }),
      cache: "no-store"
    });

    if (options.onEvent && input.engine === "opencode" && response.ok) {
      let finalResponse: AskResponse | null = null;
      let streamError: AskErrorResponse | null = null;

      await readNdjsonStream(response, parseQueryEngineStreamEvent, (event) => {
        if (event.type === "final") {
          finalResponse = event.result;
          return;
        }

        if (event.type === "error") {
          streamError = event.error;
          return;
        }

        options.onEvent?.(event);
      });

      console.log(
        `[ask:${requestId}] finish status=${response.status} duration_ms=${Date.now() - startedAt} engine=${input.engine}`
      );

      if (streamError) {
        return {
          ok: false,
          status: 502,
          error: streamError
        };
      }

      if (!finalResponse) {
        return {
          ok: false,
          status: 502,
          error: {
            ok: false,
            error: "OpenCode stream ended without a final response."
          }
        };
      }

      return {
        ok: true,
        status: response.status,
        response: finalResponse
      };
    }

    const json = await response.json();

    console.log(
      `[ask:${requestId}] finish status=${response.status} duration_ms=${Date.now() - startedAt} engine=${input.engine}`
    );

    if (!response.ok) {
      const parsedError = askErrorResponseSchema.safeParse(json);

      return {
        ok: false,
        status: response.status,
        error: parsedError.success
          ? parsedError.data
          : {
              ok: false,
              error: typeof json?.error === "string" ? json.error : "Question failed."
            }
      };
    }

    return {
      ok: true,
      status: response.status,
      response: askResponseSchema.parse(json)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to query the vault.";

    console.error(`[ask:${requestId}] error duration_ms=${Date.now() - startedAt} message="${message}"`);

    return {
      ok: false,
      status: 400,
      error: {
        ok: false,
        error: message
      }
    };
  }
}
