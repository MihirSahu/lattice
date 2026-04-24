import { NextResponse } from "next/server";
import { chatThreadPatchRequestSchema } from "@/lib/schemas";
import { getChatStore } from "@/lib/server/chat-store";
import { resolveAuthenticatedUserEmail } from "@/lib/server/request-identity";

type RouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const identity = resolveAuthenticatedUserEmail(request);

  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  try {
    const { threadId } = await context.params;
    const store = getChatStore();
    const thread = await store.getThreadDetail(identity.userEmail, threadId);

    if (!thread) {
      return NextResponse.json({ error: "Chat thread not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      thread
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load chat thread.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const identity = resolveAuthenticatedUserEmail(request);

  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  try {
    const { threadId } = await context.params;
    const body = await request.json();
    const parsed = chatThreadPatchRequestSchema.parse(body);
    const store = getChatStore();
    const thread = await store.upsertThreadSettings({
      threadId,
      userEmail: identity.userEmail,
      ...parsed,
      model: parsed.engine === "qmd" ? null : parsed.model
    });

    if (!thread) {
      return NextResponse.json({ error: "Chat thread not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      thread
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update chat thread.";
    const status = error instanceof Error && /thread setting must be provided/i.test(error.message) ? 400 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
