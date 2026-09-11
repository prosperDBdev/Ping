"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, token, fetchCurrentUser, logout } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Wait for Zustand store to rehydrate state from localStorage. This has
  // to stay effect-based rather than a lazy useState initializer: reading
  // `useAuthStore.persist` during the render phase breaks Next's server
  // prerender pass (the persist API isn't available there).
  useEffect(() => {
    const unsubFinish = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    if (useAuthStore.persist.hasHydrated()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasHydrated(true);
    }

    return () => {
      unsubFinish();
    };
  }, []);

  // Verify auth only after hydration is complete
  useEffect(() => {
    if (!hasHydrated) return;

    const verifyAuth = async () => {
      const currentToken = useAuthStore.getState().token;
      if (!currentToken) {
        setIsChecking(false);
        router.push("/auth/login");
        return;
      }

      // Re-set the Authorization header
      api.defaults.headers.common["Authorization"] = `Bearer ${currentToken}`;

      try {
        await fetchCurrentUser();
      } catch {
        logout();
        router.push("/auth/login");
      } finally {
        setIsChecking(false);
      }
    };

    verifyAuth();
  }, [hasHydrated, token, router, fetchCurrentUser, logout]);

  if (!hasHydrated || isChecking) {
    return (
      <div className="min-h-screen bg-ping-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-ping-sand border-t-ping-teal rounded-full animate-spin" />
          <p className="text-ping-text-light text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}