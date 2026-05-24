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
    const body = formData.get("body");
    const parentCommentId = formData.get("parentCommentId");

    if (typeof body !== "string" || !body.trim()) {
      return NextResponse.redirect(
        new URL(`/work-items/${id}?commentCreate=error`, request.url),
      );
    }

    const authHeaders = await getAuthProxyHeaders({
      "content-type": "application/json",
    });
    const response = await fetch(`${baseUrl}/v1/work-items/${id}/comments`, {
      method: "POST",
      cache: "no-store",
      headers: authHeaders,
      body: JSON.stringify({
        body: body.trim(),
        parentCommentId:
          typeof parentCommentId === "string" && parentCommentId.trim()
            ? parentCommentId.trim()
            : null,
      }),
    });

    const state = response.ok ? "ok" : "error";
    return NextResponse.redirect(
      new URL(`/work-items/${id}?commentCreate=${state}`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/work-items/${id}?commentCreate=error`, request.url),
    );
  }
}
