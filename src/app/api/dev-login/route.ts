import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encode } from "@auth/core/jwt";

const SESSION_COOKIE_NAME = "next-auth.session-token";
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-in-production-6e8f3a1b2c4d5e7f";

// Login directo sin NextAuth — para desarrollo con túnel
// GET /api/dev-login?email=luciana@encore.local
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "luciana@encore.local";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
        authProvider: "dev",
        onboardingCompleted: false,
      },
    });
  }

  // Create an Auth.js-compatible encrypted JWT (JWE). A plain signed JWT is
  // rejected by NextAuth/Auth.js with JWEInvalid when auth() tries to read it.
  const token = await encode({
    secret: AUTH_SECRET,
    salt: SESSION_COOKIE_NAME,
    maxAge: 60 * 60 * 24,
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      authProvider: user.authProvider,
      onboardingCompleted: user.onboardingCompleted,
    },
  });

  // Usar el host original (del túnel) para el redirect
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3001";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  // Redirigir a onboarding con la cookie de sesión
  const response = NextResponse.redirect(
    new URL("/onboarding", baseUrl),
  );

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: protocol === "https",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
}
