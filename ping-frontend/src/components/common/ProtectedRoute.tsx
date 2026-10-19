"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";

/**
 * How long a server-side verification stays trusted. Navigating to another
 * tab inside that window skips the /users/me round trip entirely.
 */
const VERIFICATION_TTL_MS = 5 * 60 * 1000;

/**
 * When the server last confirmed this browsing session, semester module
 * time. Module-level on purpose: the component unmounts and remounts on
 * every route change (each protected page's layout renders its own), and a
 * component can remember NOTHING across that — but a module does. This is
 * what makes tab switches instant: every mount used to await a fresh GET
 * /users/me before rendering anything, so every tap on a tab showed the
 * spinner and a network round trip for a fact the app had checked seconds
 * ago.
 */
let lastVerifiedAt = 0;

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, fetchCurrentUser, logout } = useAuthStore();
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
      // There's no token in JavaScript to inspect — the login is an HttpOnly
      // cookie (see authStore) — so "are we signed in?" is only ever answered
      // by the server. Re-asking costs a round trip, so the answer is cached:
      // a navigation inside a 5-minute window renders immediately.
      if (useAuthStore.getState().isAuthenticated && Date.now() - lastVerifiedAt < VERIFICATION_TTL_MS) {
        // Real requests are still refused by the server the moment the
        // cookie stops being good (a revoked or expired session answers
        // 401, and the api interceptor in lib/api signs the browser out
        // globally), so nothing is trusted past its welcome — this only
        // skips re-asking an already-answered question.
        setIsChecking(false);
        return;
      }

      try {
        // Authenticates with the cookie; answers 401 (and throws) when the
        // server no longer knows this browser.
        await fetchCurrentUser();
        lastVerifiedAt = Date.now();
      } catch {
        logout();
        router.push("/auth/login");
      } finally {
        setIsChecking(false);
      }
    };

    verifyAuth();
  }, [hasHydrated, isAuthenticated, router, fetchCurrentUser, logout]);

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