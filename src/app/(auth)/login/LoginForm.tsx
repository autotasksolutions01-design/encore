"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export default function LoginForm() {
  const { t } = useTranslation("auth");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/es/onboarding";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading("google");
    setError(null);
    await signIn("google", { callbackUrl });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading("email");
    setError(null);
    try {
      const result = await signIn("resend", {
        email,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError(t("magicLinkExpired"));
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setError(t("magicLinkExpired"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{t("loginTitle")}</h1>
        </div>

        {magicLinkSent ? (
          <div className="rounded-lg border border-green-800 bg-green-950/50 p-4 text-center">
            <p className="text-sm text-green-300">{t("magicLinkSent")}</p>
            <button
              onClick={() => setMagicLinkSent(false)}
              className="mt-3 text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              {t("resendLink")}
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading !== null}
              className={cn(
                "flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950",
                loading === "google" && "opacity-60 cursor-wait",
              )}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loading === "google" ? (
                <span>{t("app.loading", { ns: "common" })}</span>
              ) : (
                <span>{t("signInWithGoogle")}</span>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-950 px-2 text-slate-500">{t("orContinueWith")}</span>
              </div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-800 bg-red-950/50 p-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
              <div>
                <label htmlFor="email" className="sr-only">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading !== null || !email}
                className={cn(
                  "flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed",
                  loading === "email" && "opacity-60 cursor-wait",
                )}
              >
                {loading === "email" ? (
                  <span>{t("app.loading", { ns: "common" })}</span>
                ) : (
                  <span>{t("signInWithEmail")}</span>
                )}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-slate-500">
          {t("noAccount")}{" "}
          <Link href="/es/signup" className="font-medium text-brand-400 hover:text-brand-300 transition-colors">
            {t("signUpLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
