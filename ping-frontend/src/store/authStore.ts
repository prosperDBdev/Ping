import { removePushSubscription } from "@/lib/push";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import api from "@/lib/api";
import { AxiosError } from "axios";

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  note?: string | null;
  /** Only ever present for your own account (from /users/me). */
  twoFactorEnabled?: boolean;
}

interface ApiError {
  message?: string;
}

/** What the server sends when a sign-in is complete. No token in here: the
 * login rides in an HttpOnly cookie set by the same response (AuthCookie),
 * which JavaScript can't read — by design. */
export interface SignedIn {
  id: string;
  username: string;
  email: string;
}

/**
 * The result of the password step. With two-step verification on, there's no
 * token yet: a code was emailed and has to be entered (verifyLoginCode).
 */
export type LoginResult =
  | { done: true }
  | { done: false; challenge: string; emailHint: string };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  register: (username: string, email: string, password: string, inviteCode?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Second step of a two-step sign-in: the 6-digit code from the email. */
  verifyLoginCode: (challenge: string, code: string) => Promise<void>;
  /** Finish any kind of sign-in (password, code, QR) with the server's answer. */
  completeSignIn: (data: SignedIn) => void;
  logout: () => void;
  clearError: () => void;
  fetchCurrentUser: () => Promise<void>;
  updateProfile: (fields: { username?: string; note?: string; avatarUrl?: string | null; twoFactorEnabled?: boolean }) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      register: async (username: string, email: string, password: string, inviteCode?: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post("/auth/register", {
            username,
            email,
            password,
            // Only sent when the person arrived through a checked invite link.
            ...(inviteCode ? { inviteCode } : {}),
          });

          get().completeSignIn(res.data as SignedIn);
        } catch (err: unknown) {
          const error = err as AxiosError<ApiError>;
          const message =
            error.response?.data?.message ||
            "Registration failed";
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post("/auth/login", {
            username: email,
            password,
          });

          if (res.data.twoFactorRequired) {
            set({ isLoading: false });
            return { done: false, challenge: res.data.challenge, emailHint: res.data.emailHint };
          }
          get().completeSignIn(res.data as SignedIn);
          return { done: true };
        } catch (err: unknown) {
          const error = err as AxiosError<ApiError>;
          const message =
            error.response?.data?.message ||
            "Login failed";
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      verifyLoginCode: async (challenge: string, code: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post("/auth/login/verify", { challenge, code });
          get().completeSignIn(res.data as SignedIn);
        } catch (err: unknown) {
          const error = err as AxiosError<ApiError>;
          const message = error.response?.data?.message || "That code didn't work";
          set({ isLoading: false });
          // 410 means this pending sign-in is over (expired, used, or too many
          // wrong codes): the page goes back to the password step.
          throw Object.assign(new Error(message), { expired: error.response?.status === 410 });
        }
      },

      completeSignIn: ({ id, username, email }: SignedIn) => {
        // No Authorization header to set and nothing secret to hold: the
        // login cookie was set by the sign-in response itself, and every
        // request from here carries it (api is created withCredentials).
        set({
          user: { id, username, email, avatarUrl: null, status: "ONLINE" },
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        // Stop pushes to this device for this account, so the next person to
        // sign in here doesn't receive the last person's messages.
        //
        // THEN end this device's session on the server (Stage 14), so the
        // login is dead everywhere, not just forgotten by this browser —
        // that call also answers with a Max-Age=0 cookie that wipes the
        // browser's own copy. Both requests authenticate with the cookie.
        // In that order: once the session is gone the cookie can't do
        // anything any more.
        void (async () => {
          await removePushSubscription().catch(() => {});
          await api.delete("/sessions/current").catch(() => {});
        })();
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      clearError: () => set({ error: null }),

      updateProfile: (fields: { username?: string; note?: string; avatarUrl?: string | null; twoFactorEnabled?: boolean }) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...fields } : state.user,
        }));
      },

      fetchCurrentUser: async () => {
        try {
          // Authenticates with the login cookie; no header to set.
          const res = await api.get("/users/me");
          set({
            user: res.data,
            isAuthenticated: true,
          });
        } catch (err: unknown) {
          const error = err as AxiosError;
          if (error.response?.status === 401) {
            // Nothing signed in (or the server says so): drop local state.
            // The 401 response also carried a cookie wipe from the backend.
            set({ user: null, isAuthenticated: false });
            throw err;
          }
          // On network errors or offline server, retain local user session
          set({ isAuthenticated: true });
        }
      },
    }),
    {
      name: "ping-auth",
      // localStorage, not sessionStorage. sessionStorage dies the moment the
      // tab is closed or thrown away — and mobile browsers discard
      // background tabs aggressively, which once got people signed out
      // "after a day" even with a still-valid server session. Only NON-SECRET
      // identity lives here: who you are, so a reload can paint the right
      // shell without waiting on the network. The login itself is an
      // HttpOnly cookie, which survives on its own; the server session still
      // expires (7 days of inactivity — see the backend's SessionService).
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;