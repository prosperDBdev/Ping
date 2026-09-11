import axios from "axios";

// NEXT_PUBLIC_ is required, not decorative: Next.js only exposes variables with
// that prefix to code that runs in the browser, and this file runs in the
// browser. A plain API_URL would be undefined here and silently fall back.
//
// The localhost fallback keeps local development working with no .env file at
// all. It is a convenience, not a secret — this value ends up in the JavaScript
// bundle that every visitor downloads, so nothing confidential may ever live in
// a NEXT_PUBLIC_ variable.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// On app load, restore token from localStorage if it exists
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("ping-auth");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${parsed.state.token}`;
      }
    } catch {
      // Invalid stored data, ignore
    }
  }
}

// A 401 on an already-authenticated request means the server has stopped
// recognizing this session — the token expired, or (as happened here) the
// user it points to no longer exists. Without this, every individual call
// site fails silently in its own way (search just shows "no results",
// sending a message just does nothing) and there's no single obvious signal
// that you've actually been logged out. Login/register themselves are
// excluded — those can legitimately return 401 for "wrong password," which
// has nothing to do with an existing session going stale.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";

    if (status === 401 && !url.startsWith("/auth")) {
      localStorage.removeItem("ping-auth");
      delete api.defaults.headers.common["Authorization"];

      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;