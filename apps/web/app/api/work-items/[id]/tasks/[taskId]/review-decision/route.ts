import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await context.params;
  const baseUrl =
    process.env.ARCHITECTURE_FLOW_API_URL ?? "http://localhost:4000";

  try {
    const formData = await request.formData();
    const decision = formData.get("decision");
    const note = formData.get("note");

    if (decision !== "approve" && decision !== "request_changes") {
      return NextResponse.redirect(
        new URL(`/work-items/${id}?reviewDecision=error`, request.url),
      );
    }

    const response = await fetch(
      `${baseUrl}/v1/work-items/${id}/tasks/${taskId}/review-decision`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          decision,
          note: typeof note === "string" ? note.trim() || null : null,
        }),
      },
    );

    const state = response.ok ? decision : "error";
    return NextResponse.redirect(
      new URL(`/work-items/${id}?reviewDecision=${state}`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/work-items/${id}?reviewDecision=error`, request.url),
    );
  }
}
