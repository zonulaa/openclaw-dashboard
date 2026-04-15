import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import GsapProvider from "@/components/providers/gsap-provider";
import { dashboardConfig } from "@/lib/config";
import "./globals.css";

// ── Fonts ───────────────────────────────────────────────────────────
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// ── Metadata ─────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: dashboardConfig.title,
  description: "OpenClaw agent dashboard — control surface for your AI team",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

// ── Root layout ──────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `class` will be managed by next-themes; we set dark as default
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <GsapProvider>{children}</GsapProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
