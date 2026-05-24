import { headers } from "next/headers";

const FORWARDED_AUTH_HEADERS = [
  "x-authentik-email",
  "x-authentik-name",
  "x-authentik-groups",
  "x-forwarded-email",
  "x-forwarded-user",
  "x-forwarded-groups",
] as const;

export async function getAuthProxyHeaders(
  extras?: Record<string, string>,
): Promise<Record<string, string>> {
  const requestHeaders = await headers();
  const result: Record<string, string> = { ...(extras ?? {}) };

  for (const key of FORWARDED_AUTH_HEADERS) {
    const value = requestHeaders.get(key);
    if (value) {
      result[key] = value;
    }
  }

  return result;
}
