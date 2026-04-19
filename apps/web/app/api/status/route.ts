import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${config.syncWorkerUrl}/status`, {
      cache: "no-store"
    });
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load status."
      },
      { status: 502 }
    );
  }
}

