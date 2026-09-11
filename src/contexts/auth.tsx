import { useEffect } from "react";
import type { ReactNode } from "react";
import { useStore } from "@/store";

// Re-export the Zustand-backed useAuth so existing imports stay unchanged.
export { useAuth } from "@/store";

/**
 * AuthProvider is kept for backward-compat (App.tsx mounts it). It simply
 * triggers the store's auth-hydration on mount and renders its children.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const hydrateAuth = useStore((s) => s.hydrateAuth);
  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);
  return <>{children}</>;
}