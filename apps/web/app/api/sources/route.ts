import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { sourceFoldersResponseSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const response = await fetch(`${config.qmdServiceUrl}/sources`, {
      cache: "no-store"
    });
    const json = await response.json();

    if (!response.ok) {
      return NextResponse.json(json, { status: response.status });
    }

    const parsed = sourceFoldersResponseSchema.parse(json);
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load source folders.";

    return NextResponse.json(
      {
        error: message
      },
      { status: 400 }
    );
  }
}
