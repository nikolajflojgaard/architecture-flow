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
    const assignedTo = formData.get("assignedTo");
    const returnTo = formData.get("returnTo");
    const redirectTarget =
      typeof returnTo === "string" && returnTo.startsWith("/")
        ? returnTo
        : `/work-items/${id}`;

    const response = await fetch(`${baseUrl}/v1/work-items/${id}/assignment`, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        assignedTo:
          typeof assignedTo === "string" && assignedTo.trim()
            ? assignedTo.trim()
            : null,
      }),
    });

    const state = response.ok ? "ok" : "error";
    return NextResponse.redirect(
      new URL(`${redirectTarget}?assignmentChange=${state}`, request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/work-items/${id}?assignmentChange=error`, request.url),
    );
  }
}
