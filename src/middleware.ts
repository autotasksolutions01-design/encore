import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

// Rate limiting: solo activo si UPSTASH_REDIS_REST_URL está configurado
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const isUpstash = redisUrl?.startsWith("https://");

let authenticatedLimiter: Ratelimit | null = null;
let unauthenticatedLimiter: Ratelimit | null = null;
let dmLimiter: Ratelimit | null = null;

if (redisUrl && isUpstash) {
  const redis = new Redis({
    url: redisUrl,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
  });

  authenticatedLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, "1 m"),
    prefix: "ratelimit:auth",
  });

  unauthenticatedLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "ratelimit:unauth",
  });

  dmLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:dm",
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  // Locale redirect: / → /es (default)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/es", request.url));
  }

  const isApiRoute = pathname.startsWith("/api/");
  const isAuthRoute = pathname.startsWith("/api/auth/");
  const isCronRoute = pathname.startsWith("/api/cron/");
  const isAppRoute =
    pathname.startsWith("/es/app") || pathname.startsWith("/en/app");

  // Skip auth + rate limiting for NextAuth and Cron routes
  if (isAuthRoute || isCronRoute) {
    return NextResponse.next();
  }

  // Auth guard for app routes
  if (isAppRoute) {
    const session = await auth();

    if (!session?.user) {
      const locale = pathname.startsWith("/es") ? "es" : "en";
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Rate limiting for authenticated users on app routes
    if (authenticatedLimiter && session.user.id) {
      const { success } = await authenticatedLimiter.limit(session.user.id);
      if (!success) {
        return new NextResponse("Too many requests", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
    }
  }

  // DM rate limiting
  if (
    dmLimiter &&
    isApiRoute &&
    pathname.includes("/messages") &&
    request.method === "POST"
  ) {
    const session = await auth();
    if (session?.user?.id) {
      const { success } = await dmLimiter.limit(`dm:${session.user.id}`);
      if (!success) {
        return new NextResponse("Too many messages", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
    }
  }

  // General rate limiting
  if (unauthenticatedLimiter) {
    const { success } = await unauthenticatedLimiter.limit(ip);
    if (!success) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/es/:path*",
    "/en/:path*",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|icons|locales|sw.js|workbox-.*).*)",
  ],
};
