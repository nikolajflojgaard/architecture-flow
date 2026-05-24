import { NextResponse } from "next/server";
import { getAuthProxyHeaders } from "../../_lib/auth-proxy";

export async function POST(request: Request) {
  const baseUrl =
    process.env.ARCHITECTURE_FLOW_API_URL ?? "http://localhost:4000";

  try {
    const authHeaders = await getAuthProxyHeaders();
    const response = await fetch(`${baseUrl}/v1/intake-sources/sync`, {
      method: "POST",
      cache: "no-store",
      headers: authHeaders,
    });

    const syncState = response.ok
      ? "ok"
      : response.status === 403
        ? "forbidden"
        : "error";
    return NextResponse.redirect(new URL(`/?sync=${syncState}`, request.url));
  } catch {
    return NextResponse.redirect(new URL("/?sync=error", request.url));
  }
}
