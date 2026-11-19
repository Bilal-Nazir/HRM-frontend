export const productionApiUrl = "https://3.126.250.133/api";

export function resolveApiUrl(value: string | undefined, _production = false): string {
  const url = (value?.trim() || productionApiUrl).replace(/\/+$/, "");
  if (/^\/(?!\/)[a-z\d/_-]+$/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash) return url;
  } catch { /* Report configuration errors before issuing API requests. */ }
  throw new Error("NEXT_PUBLIC_API_URL must be an HTTP(S) backend URL or a same-origin path such as /api.");
}
