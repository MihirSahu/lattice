import { NextResponse } from "next/server";
import { askRequestSchema } from "@/lib/schemas";
import { executeQueryEngineRequest } from "@/lib/server/query-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = askRequestSchema.parse(body);
    const result = await executeQueryEngineRequest({
      question: parsed.question,
      folder: parsed.folder,
      engine: parsed.engine ?? "qmd",
      model: parsed.model,
      openAiRoute: parsed.openAiRoute,
      limit: parsed.limit
    });

    if (!result.ok) {
      return NextResponse.json(result.error, { status: result.status });
    }

    return NextResponse.json(result.response, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to query the vault.";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 400 }
    );
  }
}
