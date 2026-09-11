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
}

interface ApiError {
  message?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  register: (username: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  fetchCurrentUser: () => Promise<void>;
  updateProfile: (fields: { username?: string; note?: string }) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      register: async (username: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post("/auth/register", {
            username,
            email,
            password,
          });

          const { token, id, username: name, email: mail } = res.data;

          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          set({
            token,
            user: { id, username: name, email: mail, avatarUrl: null, status: "ONLINE" },
            isAuthenticated: true,
            isLoading: false,
          });
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

          const { token, id, username, email: mail } = res.data;

          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          set({
            token,
            user: { id, username, email: mail, avatarUrl: null, status: "ONLINE" },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: unknown) {
          const error = err as AxiosError<ApiError>;
          const message =
            error.response?.data?.message ||
            "Login failed";
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      logout: () => {
        delete api.defaults.headers.common["Authorization"];
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      clearError: () => set({ error: null }),

      updateProfile: (fields: { username?: string; note?: string }) => {
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