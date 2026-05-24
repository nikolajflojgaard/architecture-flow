import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const baseUrl =
    process.env.ARCHITECTURE_FLOW_API_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${baseUrl}/v1/intake-sources/sync`, {
      method: "POST",
      cache: "no-store",
    });

    const syncState = response.ok ? "ok" : "error";
    return NextResponse.redirect(new URL(`/?sync=${syncState}`, request.url));
  } catch {
    return NextResponse.redirect(new URL("/?sync=error", request.url));
  }
}
