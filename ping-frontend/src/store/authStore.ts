import { removePushSubscription } from "@/lib/push";
import { create } from "zustand";
import { persist } from "zustand/middleware";
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

/** What the server sends when a sign-in is complete. */
export interface SignedIn {
  token: string;
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
  token: string | null;
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
      token: null,
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

      completeSignIn: ({ token, id, username, email }: SignedIn) => {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        set({
          token,
          user: { id, username, email, avatarUrl: null, status: "ONLINE" },
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        // Stop pushes to this device for this account, so the next person to
        // sign in here doesn't receive the last person's messages. The token
        // is passed explicitly because the header is removed straight after.
        //
        // THEN end this device's session on the server (Stage 14), so the
        // token is dead everywhere, not just forgotten by this browser. In that
        // order: once the session is gone the token can't remove the push
        // subscription any more.
        const token = get().token;
        if (token) {
          void (async () => {
            await removePushSubscription(token).catch(() => {});
            await api
              .delete("/sessions/current", { headers: { Authorization: `Bearer ${token}` } })
              .catch(() => {});
          })();
        }
        delete api.defaults.headers.common["Authorization"];
        set({
          token: null,
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
        const token = get().token;
        if (!token) return;

        try {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          const res = await api.get("/users/me");
          set({
            user: res.data,
            isAuthenticated: true,
          });
        } catch (err: unknown) {
          const error = err as AxiosError;
          if (error.response?.status === 401) {
            set({ token: null, user: null, isAuthenticated: false });
            delete api.defaults.headers.common["Authorization"];
            throw err;
          }
          // On network errors or offline server, retain local user session
          set({ isAuthenticated: true });
        }
      },
    }),
    {
      name: "ping-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;