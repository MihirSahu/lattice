import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const trigger = typeof body.trigger === "string" ? body.trigger : "manual";

    const response = await fetch(`${config.syncWorkerUrl}/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ trigger }),
      cache: "no-store"
    });
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to trigger sync."
      },
      { status: 502 }
    );
  }
}

