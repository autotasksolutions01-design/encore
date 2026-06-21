import { check, sleep, group } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

/**
 * k6 load test script for Encore MVP — search/discovery performance.
 *
 * Target: 100 concurrent searches < 2s (R16, cross-cutting).
 *
 * Usage:
 *   k6 run --vus 10 --duration 30s k6/search-load-test.js
 *
 * Or with environment override:
 *   E2E_BASE_URL=https://encore-mvp.vercel.app k6 run --vus 50 --duration 60s k6/search-load-test.js
 */

const BASE_URL = __ENV.E2E_BASE_URL || "http://localhost:3000";

// Test locations for spatial queries
const LOCATIONS = [
  { lat: -34.6037, lng: -58.3816, name: "Buenos Aires" },
  { lat: -34.588, lng: -58.431, name: "Palermo" },
  { lat: -34.615, lng: -58.434, name: "Caballito" },
  { lat: -31.4201, lng: -64.1888, name: "Córdoba" },
  { lat: -32.9475, lng: -60.6393, name: "Rosario" },
];

// Test genres and instruments for filtering
const GENRES = ["rock", "jazz", "blues", "funk", "indie", "electronica", "folk", "clasica", "tango", "reggae"];
const INSTRUMENTS = ["guitarra", "bajo", "bateria", "piano", "voz", "saxo", "violin"];

// Custom metrics
const searchLatency = new Trend("search_latency");
const searchSuccessRate = new Rate("search_success");
const apiLatency = new Trend("api_latency");
const apiSuccessRate = new Rate("api_success");

export default function () {
  group("Discovery search", () => {
    // Random location
    const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    // Random filters
    const instrument = INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)];
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];

    const url = `${BASE_URL}/es/discover?instrument=${instrument}&genre=${genre}&lat=${loc.lat}&lng=${loc.lng}&radius=25`;
    
    const start = Date.now();
    const res = http.get(url, {
      headers: { "Accept": "text/html" },
      timeout: 5000,
    });
    
    const duration = Date.now() - start;
    searchLatency.add(duration);
    searchSuccessRate.add(res.status === 200);

    check(res, {
      "discovery returns 200": (r) => r.status === 200,
      "discovery response under 2s": () => duration < 2000,
    });

    sleep(1);
  });

  group("Jam feed", () => {
    const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];

    const url = `${BASE_URL}/es/jams?genre=${genre}&lat=${loc.lat}&lng=${loc.lng}&radius=50`;

    const start = Date.now();
    const res = http.get(url, {
      headers: { "Accept": "text/html" },
      timeout: 5000,
    });

    const duration = Date.now() - start;
    searchLatency.add(duration);
    searchSuccessRate.add(res.status === 200);

    check(res, {
      "jam feed returns 200": (r) => r.status === 200,
      "jam feed under 2s": () => duration < 2000,
    });

    sleep(1);
  });

  group("Profile page (ISR)", () => {
    // Simulate visiting a public profile
    const url = `${BASE_URL}/es/profile/some-profile-id`;

    const start = Date.now();
    const res = http.get(url, {
      headers: { "Accept": "text/html" },
      timeout: 5000,
    });

    const duration = Date.now() - start;
    searchLatency.add(duration);
    searchSuccessRate.add(res.status === 200 || res.status === 404);

    check(res, {
      "profile page under 2.5s": () => duration < 2500,
    });

    sleep(1);
  });

  group("API discovery", () => {
    const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const instrument = INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)];

    const url = `${BASE_URL}/api/profiles?instrument=${instrument}&lat=${loc.lat}&lng=${loc.lng}&radius=25&page=1`;

    const start = Date.now();
    const res = http.get(url, {
      headers: { "Accept": "application/json" },
      timeout: 5000,
    });

    const duration = Date.now() - start;
    apiLatency.add(duration);
    apiSuccessRate.add(res.status === 200);

    check(res, {
      "API discovery returns 200": (r) => r.status === 200,
      "API response under 2s": () => duration < 2000,
    });

    sleep(0.5);
  });
}

export const options = {
  thresholds: {
    "search_latency": ["p(95)<2000"],
    "search_success": ["rate>0.95"],
    "api_latency": ["p(95)<2000"],
    "api_success": ["rate>0.99"],
    "http_req_duration": ["p(95)<3000"],
    "http_req_failed": ["rate<0.05"],
  },
  scenarios: {
    search_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "20s", target: 50 },
        { duration: "10s", target: 100 },
        { duration: "20s", target: 100 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
};
