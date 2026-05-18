import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const baseUrl = process.env.ARCHITECTURE_FLOW_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/v1/work-items/${id}/classify-intake`, {
      method: 'POST',
      cache: 'no-store',
    });

    const state = response.ok ? 'ok' : 'error';
    return NextResponse.redirect(new URL(`/work-items/${id}?classified=${state}`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`/work-items/${id}?classified=error`, request.url));
  }
}
