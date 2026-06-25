import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Encore",
  description: "Conectá con músicos. Descubrí. Tocá.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Encore",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4c6ef5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('encore-theme');
                  if (theme === 'midnight' || theme === 'stage' || theme === 'daylight') {
                    document.documentElement.classList.add(theme);
                  } else if (theme === 'dark') {
                    document.documentElement.classList.add('midnight');
                  } else if (theme === 'light') {
                    document.documentElement.classList.add('daylight');
                  } else {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'daylight';
                    document.documentElement.classList.add(theme);
                  }
                } catch (e) {
                  document.documentElement.classList.add('midnight');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen" style={{ background: "var(--ec-bg, #0d1117)", color: "var(--ec-text, #e6edf3)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
