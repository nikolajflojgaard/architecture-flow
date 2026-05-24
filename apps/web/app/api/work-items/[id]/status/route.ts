import { NextResponse } from "next/server";

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

    if (typeof status !== "string" || !status) {
      return NextResponse.redirect(
        new URL(`/work-items/${id}?statusChange=error`, request.url),
      );
    }

    const response = await fetch(`${baseUrl}/v1/work-items/${id}/status`, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    const state = response.ok ? "ok" : "error";
    return NextResponse.redirect(
      new URL(`/work-items/${id}?statusChange=${state}`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/work-items/${id}?statusChange=error`, request.url),
    );
  }
}
