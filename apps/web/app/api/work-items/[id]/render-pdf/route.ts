import { NextResponse } from "next/server";
import { getAuthProxyHeaders } from "../../../_lib/auth-proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const baseUrl =
    process.env.ARCHITECTURE_FLOW_API_URL ?? "http://localhost:4000";

  try {
    const authHeaders = await getAuthProxyHeaders();
    const response = await fetch(`${baseUrl}/v1/work-items/${id}/render-pdf`, {
      method: "POST",
      cache: "no-store",
      headers: authHeaders,
    });

    const state = response.ok ? "ok" : "error";
    return NextResponse.redirect(
      new URL(`/work-items/${id}?rendered=${state}`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/work-items/${id}?rendered=error`, request.url),
    );
  }
}
