import { NextResponse } from "next/server";
import {
  applyStreamEventToState,
  createPendingAssistantStreamState,
  finalizeAssistantStreamState
} from "@/lib/chat-trace";
import { encodeNdjsonEvent } from "@/lib/ndjson";
import { chatAskRequestSchema } from "@/lib/schemas";
import { type AppendQuestionAndAnswerInput, ChatThreadNotFoundError, getChatStore } from "@/lib/server/chat-store";
import { executeQueryEngineRequest } from "@/lib/server/query-engine";
import { resolveAuthenticatedUserEmail } from "@/lib/server/request-identity";

async function appendChatTurnWithStaleThreadRecovery(input: AppendQuestionAndAnswerInput) {
  const store = getChatStore();

  try {
    return await store.appendQuestionAndAnswer(input);
  } catch (error) {
    if (!(error instanceof ChatThreadNotFoundError) || !input.threadId) {
      throw error;
    }

    return store.appendQuestionAndAnswer({
      ...input,
      threadId: undefined
    });
  }
}

export async function POST(request: Request) {
  const identity = resolveAuthenticatedUserEmail(request);

  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  try {
    const body = await request.json();
    const parsed = chatAskRequestSchema.parse(body);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const writeEvent = (event: unknown) => {
          controller.enqueue(encoder.encode(encodeNdjsonEvent(event)));
        };

        void (async () => {
          try {
            let assistantStream = createPendingAssistantStreamState();
            const result = await executeQueryEngineRequest(parsed, {
              onEvent: (event) => {
                assistantStream = applyStreamEventToState(assistantStream, event);
                writeEvent(event);
              }
            });
            const thread = await appendChatTurnWithStaleThreadRecovery({
              threadId: parsed.threadId,
              userEmail: identity.userEmail,
              question: parsed.question,
              engine: parsed.engine,
              folder: parsed.folder,
              model: parsed.model,
              openAiRoute: parsed.openAiRoute,
              successResponse: result.ok ? result.response : undefined,
              errorResponse: result.ok ? undefined : result.error,
              assistantStream: finalizeAssistantStreamState(assistantStream)
            });

            writeEvent({
              type: "final",
              response: {
                ok: result.ok,
                thread,
                error: result.ok ? undefined : result.error
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to persist chat turn.";
            writeEvent({
              type: "error",
              message
            });
          } finally {
            controller.close();
          }
        })();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist chat turn.";
    const status = error instanceof Error && /required|invalid|expected/i.test(error.message) ? 400 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
