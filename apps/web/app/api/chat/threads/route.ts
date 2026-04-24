import { NextResponse } from "next/server";
import { getChatStore } from "@/lib/server/chat-store";
import { resolveAuthenticatedUserEmail } from "@/lib/server/request-identity";

export async function GET(request: Request) {
  const identity = resolveAuthenticatedUserEmail(request);

  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: identity.status });
  }

  try {
    const store = getChatStore();
    const threads = await store.listThreadSummaries(identity.userEmail);

    return NextResponse.json({
      ok: true,
      userEmail: identity.userEmail,
      threads
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load chat threads.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
