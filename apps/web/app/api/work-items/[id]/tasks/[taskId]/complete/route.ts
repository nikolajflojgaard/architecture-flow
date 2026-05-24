import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await context.params;
  const baseUrl =
    process.env.ARCHITECTURE_FLOW_API_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(
      `${baseUrl}/v1/work-items/${id}/tasks/${taskId}/complete`,
      {
        method: "POST",
        cache: "no-store",
      },
    );

    const state = response.ok ? "ok" : "error";
    return NextResponse.redirect(
      new URL(`/work-items/${id}?taskComplete=${state}`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/work-items/${id}?taskComplete=error`, request.url),
    );
  }
}
