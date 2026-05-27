import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/hooks/useToast";
import TopNavbar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import QueryProvider from "@/lib/QueryProvider";
import { ThemeProvider } from "@/lib/ThemeProvider";
import PageTransition from "@/components/PageTransition";
import GlobalSearch from "@/components/GlobalSearch";

export const metadata: Metadata = {
  title: "Sakura Studio",
  description: "Sistema de gestión para tu estudio de belleza",
  icons: {
    icon: "/logo.png",
  },
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
          </AuthGuard>
        </ToastProvider>
        </AuthProvider>
        </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
