import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/hooks/useToast";
import TopNavbar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import QueryProvider from "@/lib/QueryProvider";
import { ThemeProvider } from "@/lib/ThemeProvider";
import PageTransition from "@/components/PageTransition";
import GlobalSearch from "@/components/GlobalSearch";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Sakura Studio",
  description: "Sistema de gestión para tu estudio de belleza",
  icons: {
    icon: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sakura Studio",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
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
    <html lang="es" className="h-full" suppressHydrationWarning>
      <body className="antialiased h-full" style={{ background: "var(--bg-body)" }}>
        <QueryProvider>
        <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
          <AuthGuard>
            <ErrorBoundary>
              <GlobalSearch />
              <div className="min-h-full flex flex-col">
                <TopNavbar />
                <main className="flex-1" style={{ background: "var(--bg-body)" }}>
                  <div className="px-6 sm:px-10 lg:px-20 xl:px-28 py-3 lg:py-4 min-h-full flex flex-col">
                    <PageTransition>
                      {children}
                    </PageTransition>
                  </div>
                </main>
              </div>
            </ErrorBoundary>
          </AuthGuard>
        </ToastProvider>
        </AuthProvider>
        </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
