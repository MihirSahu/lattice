import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { opencodeModelsResponseSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const response = await fetch(`${config.opencodeServiceUrl}/models`, {
      cache: "no-store"
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Unable to load OpenCode models.");
    }

    const parsed = opencodeModelsResponseSchema.parse(json);

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load OpenCode models.";

    return NextResponse.json(
      {
        error: message
      },
      { status: 502 }
    );
  }
}
