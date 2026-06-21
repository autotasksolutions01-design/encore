import { Serwist, CacheFirst, StaleWhileRevalidate, NetworkFirst, NetworkOnly, ExpirationPlugin } from "serwist";
import type { PrecacheEntry } from "serwist";

// Service Worker entry point — compiled by @serwist/next in a Worker context.
// __SW_MANIFEST is injected by the build plugin.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const swSelf = self as any;

const serwist = new Serwist({
  precacheEntries: swSelf.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache-first for static assets and ISR pages (profiles, landing)
    {
      matcher: ({ request, url }: { request: Request; url: URL }) => {
        if (request.destination === "document") {
          return (
            url.pathname === "/es" ||
            url.pathname === "/en" ||
            url.pathname.startsWith("/es/profile/") ||
            url.pathname.startsWith("/en/profile/")
          );
        }
        return false;
      },
      handler: new CacheFirst({
        cacheName: "static-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60,
          }),
        ],
      }),
    },
    // Network-first for API routes
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 5,
          }),
        ],
      }),
    },
    // Stale-while-revalidate for discovery pages (jam feed, discover)
    {
      matcher: ({ url }: { url: URL }) =>
        url.pathname.startsWith("/es/discover") ||
        url.pathname.startsWith("/en/discover") ||
        url.pathname.startsWith("/es/jams") ||
        url.pathname.startsWith("/en/jams"),
      handler: new StaleWhileRevalidate({
        cacheName: "dynamic-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 5,
          }),
        ],
      }),
    },
    // Network-only for auth routes
    {
      matcher: ({ url }: { url: URL }) =>
        url.pathname.startsWith("/es/login") ||
        url.pathname.startsWith("/en/login") ||
        url.pathname.startsWith("/es/signup") ||
        url.pathname.startsWith("/en/signup") ||
        url.pathname.startsWith("/es/onboarding") ||
        url.pathname.startsWith("/en/onboarding") ||
        url.pathname.startsWith("/api/auth/"),
      handler: new NetworkOnly(),
    },
    // Static assets (Next.js bundled JS/CSS)
    {
      matcher: ({ request }: { request: Request }) =>
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "font",
      handler: new CacheFirst({
        cacheName: "static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Images
    {
      matcher: ({ request }: { request: Request }) =>
        request.destination === "image",
      handler: new StaleWhileRevalidate({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/es",
        matcher: ({ request }: { request: Request }) =>
          request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();
