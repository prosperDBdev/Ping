import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import ThemeProvider from "@/components/common/ThemeProvider";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Ping — Real-Time Messaging",
  description:
    "A real-time space for the people you actually want to hear from.",
  // Safari ignores the web app manifest entirely and reads these instead, which
  // is why an installed Ping on iOS needs its own set of instructions here
  // rather than inheriting anything from manifest.ts.
  appleWebApp: {
    capable: true,
    title: "Ping",
    // The status bar text sits directly over the top of the page, so it is
    // styled rather than given a bar of its own — "default" would leave a grey
    // strip above the app.
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

/**
 * Viewport is its own export in the App Router, not part of metadata.
 *
 * `viewportFit: "cover"` is what lets the app paint underneath the notch and
 * the home indicator on an iPhone. It is also what makes `env(safe-area-inset-*)`
 * return real values in CSS — without it those are always zero, and the padding
 * that keeps the message composer clear of the home bar silently does nothing.
 */
export const viewport: Viewport = {
  themeColor: "#e0684b",
  viewportFit: "cover",
  // Stops iOS zooming the whole page when someone taps the message input, which
  // in a standalone app leaves them stranded at 1.3x with no address bar to
  // reset it.
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem("ping-theme");
                  var theme = stored ? JSON.parse(stored).state.theme : "system";
                  var isDark =
                    theme === "dark" ||
                    (theme === "system" &&
                      window.matchMedia("(prefers-color-scheme: dark)").matches);
                  document.documentElement.classList.toggle("dark", isDark);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegistrar />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}