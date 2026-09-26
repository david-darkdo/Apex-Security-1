export function getProductionOrigin(request?: Request): string {
  // 1. Client-side browser execution: always use window.location.origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 2. Incoming request context if provided (SSR headers)
  if (request) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host) {
      return `${proto}://${host}`;
    }
  }

  // 3. Explicit canonical site URL configuration
  if (process.env.SITE_URL) {
    const url = process.env.SITE_URL.trim().replace(/\/$/, "");
    return url.startsWith("http") ? url : `https://${url}`;
  }

  // 4. Vercel deployment preview / production URL
  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL.trim().replace(/\/$/, "");
    return url.startsWith("http") ? url : `https://${url}`;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const url = process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/$/, "");
    return url.startsWith("http") ? url : `https://${url}`;
  }

  // 5. Client Vite env variable fallback
  if (process.env.VITE_SITE_URL) {
    const url = process.env.VITE_SITE_URL.trim().replace(/\/$/, "");
    return url.startsWith("http") ? url : `https://${url}`;
  }

  // 6. Safe local fallback
  return "http://localhost:3000";
}
