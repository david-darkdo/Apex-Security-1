export const CANONICAL_ORIGIN = "https://apexsecurity.com.ng";

export function getProductionOrigin(request?: Request): string {
  // 1. Client-side browser execution: allow localhost in local development
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return window.location.origin;
    }
    return CANONICAL_ORIGIN;
  }

  // 2. Incoming request context: allow localhost in local development
  if (request) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host && (host.includes("localhost") || host.includes("127.0.0.1"))) {
      const proto = request.headers.get("x-forwarded-proto") || "http";
      return `${proto}://${host}`;
    }
  }

  // 3. In local node development mode
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // 4. Authoritative production canonical origin for all sitemaps, canonical tags, and structured data
  return CANONICAL_ORIGIN;
}
