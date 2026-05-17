import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const baseUrl = process.env.ARCHITECTURE_FLOW_API_URL ?? 'http://localhost:4000';

  try {
    await fetch(`${baseUrl}/v1/intake-sources/sync`, {
      method: 'POST',
      cache: 'no-store',
    });
  } catch {
    // swallow for now; the shell should still return the user to the dashboard
  }

  return NextResponse.redirect(new URL('/?sync=1', request.url));
}
