"use client";

import { Toaster } from "react-hot-toast";

/**
 * The one place toasts are drawn, mounted once in the root layout.
 *
 * Every page used to mount its own <Toaster />, and pages that forgot one
 * (Settings, Home, Status, Memories) silently swallowed every toast: an
 * unblock confirmation, a photo upload error, a wrong password. One app-wide
 * Toaster means a toast from anywhere always shows, exactly once.
 */
export default function AppToaster() {
  return <Toaster position="top-center" />;
}
