"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";

/**
 * How long a server-side verification stays trusted. Navigating to another
 * tab inside that window skips the /users/me round trip entirely.
 */
const VERIFICATION_TTL_MS = 5 * 60 * 1000;

/**
 * The token whose owner was last verified with the server, and when that was.
 *
 * Module-level on purpose: the component unmounts and remounts on every route
 * change (each protected page's layout renders its own), and a component can
 * remember NOTHING across that — but a module does. This is what makes tab
 * switches instant: every mount used to await a fresh GET /users/me before
 * rendering anything, so every tap on a tab showed the spinner and a network
 * round trip for a fact the app had checked seconds ago.
 */
let lastVerified: { token: string; at: number } | null = null;

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

      // Already verified this token for this browsing session: render now.
      // The token can still BE rejected server-side on any real request (a
      // revoked or expired session returns 401, and the api interceptor in
      // lib/api signs the browser out globally), so nothing is trusted past
      // its welcome — this only skips re-asking an already-answered question.
      if (
        lastVerified &&
        lastVerified.token === currentToken &&
        Date.now() - lastVerified.at < VERIFICATION_TTL_MS
      ) {
        setIsChecking(false);
        return;
      }

      // Re-set the Authorization header
      api.defaults.headers.common["Authorization"] = `Bearer ${currentToken}`;

      try {
        await fetchCurrentUser();
        lastVerified = { token: currentToken, at: Date.now() };
      } catch {
        lastVerified = null;
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