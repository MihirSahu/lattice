import { randomUUID } from "node:crypto";
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

function previewQuestion(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 119)}…`;
}

export async function executeQueryEngineRequest(
  input: Pick<ChatAskRequest, "engine" | "folder" | "model" | "question"> & {
    limit?: number;
  }
): Promise<QueryEngineResult> {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const serviceUrl = input.engine === "opencode" ? config.opencodeServiceUrl : config.qmdServiceUrl;
  const effectiveLimit = resolveQueryLimit(input.limit, config.defaultQueryLimit);

  console.log(
    `[ask:${requestId}] start engine=${input.engine} folder=${input.folder || "<all>"} limit=${effectiveLimit} question="${previewQuestion(input.question)}"`
  );

  try {
    const response = await fetch(`${serviceUrl}/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId
      },
      body: JSON.stringify({
        question: input.question,
        folder: input.folder || undefined,
        model: input.engine === "opencode" ? input.model : undefined,
        limit: effectiveLimit
      }),
      cache: "no-store"
    });
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
