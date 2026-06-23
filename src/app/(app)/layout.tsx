"use client";

import { useUIStore } from "@/lib/stores/ui";
import { useAuthStore } from "@/lib/stores/auth";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { key: "discover", href: "/es/discover" },
  { key: "profile", href: "/es/profile/edit" },
  { key: "connections", href: "/es/connections" },
  { key: "messages", href: "/es/messages" },
  { key: "jams", href: "/es/jams" },
] as const;

const NAV_ICONS: Record<string, string> = {
  discover: "🔍",
  profile: "👤",
  connections: "🤝",
  messages: "💬",
  jams: "🎵",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore();
  const { userId, clearAuth } = useAuthStore();
  const { t } = useTranslation("common");
  const pathname = usePathname();

  if (!userId) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200",
          sidebarOpen ? "w-64" : "w-16",
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center h-16 px-4 border-b border-slate-800">
          <button
            onClick={toggleSidebar}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <span className="text-xl font-bold text-brand-500">
              {sidebarOpen ? "Encore" : "E"}
            </span>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-600/20 text-brand-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800",
                )}
              >
                <span className="w-5 h-5 flex items-center justify-center">{NAV_ICONS[item.key] || "●"}</span>
                {sidebarOpen && <span>{t(`nav.${item.key}`)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {sidebarOpen ? (theme === "dark" ? "☀️ Claro" : "🌙 Oscuro") : (theme === "dark" ? "☀️" : "🌙")}
          </button>
          <button
            onClick={() => {
              clearAuth();
              signOut({ callbackUrl: "/es" });
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            {sidebarOpen ? t("nav.logout") : "←"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center h-16 px-6 border-b border-slate-800 bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-200">
            {t("app.name")}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
