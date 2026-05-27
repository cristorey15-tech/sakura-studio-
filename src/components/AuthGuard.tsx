"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // No hacer nada mientras carga
    if (loading) return;

    // Si está en login y ya tiene sesión, ir al dashboard
    if (user && pathname === "/login") {
      router.push("/");
      return;
    }

    // Si NO está en login y NO tiene sesión, ir al login
    if (!user && pathname !== "/login") {
      router.push("/login");
      return;
    }
  }, [user, loading, pathname, router]);

  // Mientras verifica auth, mostrar loading
  if (loading && pathname !== "/login") {
    return (
      <div className="min-h-full flex items-center justify-center flex-1">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
