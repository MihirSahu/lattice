import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { askRequestSchema } from "@/lib/schemas";

function previewQuestion(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 119)}…`;
}

export async function POST(request: Request) {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = askRequestSchema.parse(body);
    const engine = parsed.engine ?? "qmd";
    const serviceUrl = engine === "opencode" ? config.opencodeServiceUrl : config.qmdServiceUrl;
    const questionPreview = previewQuestion(parsed.question);

    console.log(
      `[ask:${requestId}] start engine=${engine} folder=${parsed.folder ?? "<all>"} limit=${parsed.limit ?? config.defaultQueryLimit} question="${questionPreview}"`
    );

    const response = await fetch(`${serviceUrl}/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId
      },
      body: JSON.stringify({
        question: parsed.question,
        folder: parsed.folder,
        model: engine === "opencode" ? parsed.model : undefined,
        limit: parsed.limit ?? config.defaultQueryLimit
      }),
      cache: "no-store"
    });
    const json = await response.json();

    console.log(
      `[ask:${requestId}] finish status=${response.status} duration_ms=${Date.now() - startedAt} engine=${engine}`
    );

    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to query the vault.";

    console.error(`[ask:${requestId}] error duration_ms=${Date.now() - startedAt} message="${message}"`);

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 400 }
    );
  }
}
