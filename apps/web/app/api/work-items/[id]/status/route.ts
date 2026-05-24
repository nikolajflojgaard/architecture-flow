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
    const formData = await request.formData();
    const status = formData.get("status");
    const returnTo = formData.get("returnTo");
    const redirectTarget =
      typeof returnTo === "string" && returnTo.startsWith("/")
        ? returnTo
        : `/work-items/${id}`;

    if (typeof status !== "string" || !status) {
      return NextResponse.redirect(
        new URL(`${redirectTarget}?statusChange=error`, request.url),
      );
    }

    const authHeaders = await getAuthProxyHeaders({
      "content-type": "application/json",
    });
    const response = await fetch(`${baseUrl}/v1/work-items/${id}/status`, {
      method: "PATCH",
      cache: "no-store",
      headers: authHeaders,
      body: JSON.stringify({ status }),
    });

    const state = response.ok ? "ok" : "error";
    return NextResponse.redirect(
      new URL(`${redirectTarget}?statusChange=${state}`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/work-items/${id}?statusChange=error`, request.url),
    );
  }
}
