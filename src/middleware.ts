import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const unauthenticatedLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "ratelimit:unauth",
});

const authenticatedLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, "1 m"),
  analytics: true,
  prefix: "ratelimit:auth",
});

const dmLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "ratelimit:dm",
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  // Locale redirect: / → /es (default)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/es", request.url));
  }

  const isApiRoute = pathname.startsWith("/api/");
  const isAppRoute =
    pathname.startsWith("/es/app") || pathname.startsWith("/en/app");

  // Auth guard for app routes only (APIs handle their own auth)
  if (isAppRoute) {
    const session = await auth();

    if (!session?.user) {
      const locale = pathname.startsWith("/es") ? "es" : "en";
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Rate limiting for authenticated users on app routes
    const userId = session.user.id;
    if (userId) {
      const { success: authSuccess } =
        await authenticatedLimiter.limit(userId);
      if (!authSuccess) {
        return new NextResponse("Too many requests", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
    }
  }

  // DM rate limiting for messages API (POST only)
  if (isApiRoute && pathname.includes("/messages") && request.method === "POST") {
    const session = await auth();
    if (session?.user?.id) {
      const { success: dmSuccess } = await dmLimiter.limit(
        `dm:${session.user.id}`,
      );
      if (!dmSuccess) {
        return new NextResponse("Too many messages", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
    }
  }

  // Authenticated rate limiting for API routes
  if (isApiRoute) {
    const session = await auth();
    if (session?.user?.id) {
      const { success: authSuccess } = await authenticatedLimiter.limit(
        session.user.id,
      );
      if (!authSuccess) {
        return new NextResponse("Too many requests", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
    }
  }

  // Rate limiting for unauthenticated users
  const { success: unauthSuccess } = await unauthenticatedLimiter.limit(ip);
  if (!unauthSuccess) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
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
