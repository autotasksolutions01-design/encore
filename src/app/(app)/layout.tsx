"use client";

import { useUIStore } from "@/lib/stores/ui";
import { useAuthStore } from "@/lib/stores/auth";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { key: "jams", href: "/es/jams" },
  { key: "discover", href: "/es/discover" },
  { key: "messages", href: "/es/messages" },
  { key: "profile", href: "/es/profile/edit" },
] as const;

const JamsIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);

const BuscarIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-3.6-3.6" />
  </svg>
);

const MensajesIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.4 8.4 0 0 1-12.1 7.6L3 21l1.9-5.9A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);

const PerIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M5 21v-1.5a7 7 0 0 1 14 0V21" />
  </svg>
);

const NAV_ICONS: Record<string, React.ReactNode> = {
  jams: <JamsIcon />,
  discover: <BuscarIcon />,
  messages: <MensajesIcon />,
  profile: <PerIcon />,
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1000);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isDesktop;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useUIStore();
  const { userId, clearAuth } = useAuthStore();
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const isDesktop = useIsDesktop();

  if (!userId) {
    return <>{children}</>;
  }

  const DesktopNavLink = ({ item }: { item: (typeof NAV_ITEMS)[number] }) => {
    const isActive = pathname.startsWith(item.href);
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-[13px] px-3 py-[11px] rounded-[12px] text-[14.5px] font-[550] transition-all duration-150",
          isActive
            ? "bg-brand-600/14 text-brand-500"
            : "text-[#6b7785] hover:text-slate-200",
        )}
      >
        {NAV_ICONS[item.key]}
        <span>{t(`nav.${item.key}`)}</span>
      </Link>
    );
  };

  const MobileTab = ({ item }: { item: (typeof NAV_ITEMS)[number] }) => {
    const isActive = pathname.startsWith(item.href);
    return (
      <Link
        href={item.href}
        className={cn(
          "flex flex-col items-center gap-[3px] flex-1 py-[5px] transition-colors duration-150",
          isActive ? "text-brand-500" : "text-[#6b7785]",
        )}
      >
        <div className="w-[23px] h-[23px] flex items-center justify-center">
          {NAV_ICONS[item.key]}
        </div>
        <span className="text-[10.5px] font-[550]">{t(`nav.${item.key}`)}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {isDesktop && (
        <aside className="w-[248px] flex-shrink-0 flex flex-col bg-[#161b22] border-r border-[#2a3140] px-4 pt-[22px] pb-4">
          <div className="flex items-center gap-[10px] px-2 pb-[22px]">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-brand-500 flex items-center justify-center text-white font-bold text-[19px] font-[family-name:var(--font-space-grotesk)]">
              E
            </div>
            <span className="text-[21px] font-bold tracking-[-0.5px] font-[family-name:var(--font-space-grotesk)] text-slate-100">
              Encore
            </span>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {NAV_ITEMS.map((item) => (
              <DesktopNavLink key={item.key} item={item} />
            ))}
          </nav>

          <div className="border-t border-[#2a3140] pt-[14px] flex flex-col gap-3">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-[10px] px-3 py-[9px] rounded-[11px] border border-[#2a3140] bg-transparent text-[#6b7785] text-[13px] font-[550] hover:text-slate-200 transition-colors"
            >
              <span>{theme === "dark" ? "☀️" : "🌙"}</span>
              <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
            </button>
            <button
              onClick={() => {
                clearAuth();
                signOut({ callbackUrl: "/es" });
              }}
              className="flex items-center gap-[10px] px-3 py-[9px] rounded-[11px] border border-[#2a3140] bg-transparent text-[#6b7785] text-[13px] font-[550] hover:text-red-400 transition-colors"
            >
              <span>←</span>
              <span>{t("nav.logout")}</span>
            </button>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isDesktop && (
          <header className="flex-shrink-0 flex items-center justify-between px-[18px] pt-[14px] pb-3 bg-slate-950 border-b border-slate-800/30">
            <div className="flex items-center gap-[9px]">
              <div className="w-[30px] h-[30px] rounded-[9px] bg-brand-500 flex items-center justify-center text-white font-bold text-[17px] font-[family-name:var(--font-space-grotesk)]">
                E
              </div>
              <span className="text-[19px] font-bold tracking-[-0.5px] font-[family-name:var(--font-space-grotesk)] text-slate-100">
                Encore
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="w-[34px] h-[34px] rounded-[10px] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
              aria-label={theme === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </header>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>

        {!isDesktop && (
          <nav className="flex-shrink-0 flex items-center justify-around px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] bg-[#161b22] border-t border-[#2a3140]">
            {NAV_ITEMS.map((item) => (
              <MobileTab key={item.key} item={item} />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
