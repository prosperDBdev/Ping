"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import usePwaInstall from "@/hooks/usePwaInstall";
import IosInstallSheet from "./IosInstallSheet";

interface InstallAppButtonProps {
  /** "solid" for the primary CTA, "ghost" for the footer link. */
  variant?: "solid" | "ghost";
  className?: string;
}

/**
 * The "Download app" button, which is four different buttons depending on who
 * is looking at it.
 *
 * Installed already      -> nothing at all
 * Android / Chrome       -> "Install app", fires the real system prompt
 * iPhone / iPad          -> "Add to Home Screen", opens the walkthrough
 * Anything else          -> honest copy, no promise it can't keep
 *
 * The label changes with the platform on purpose. "Download" is the word people
 * expect, but nothing is downloaded from a store here, and on iOS the user has
 * to perform the install themselves — a button labelled "Download" that opens
 * an instruction sheet feels broken, while "Add to Home Screen" is exactly what
 * they're about to do and matches the words Safari itself uses.
 */
export default function InstallAppButton({
  variant = "solid",
  className = "",
}: InstallAppButtonProps) {
  const { isStandalone, canPromptInstall, needsManualInstructions, promptInstall } =
    usePwaInstall();
  const [showIosSheet, setShowIosSheet] = useState(false);

  // Already running as an installed app — offering to install it again is noise.
  if (isStandalone) return null;

  const handleClick = async () => {
    if (canPromptInstall) {
      const accepted = await promptInstall();
      if (accepted) toast.success("Ping is on your home screen.", { icon: "⚡" });
      return;
    }

    if (needsManualInstructions) {
      setShowIosSheet(true);
      return;
    }

    // Desktop Chrome that hasn't fired the prompt yet, or a browser with no
    // install support at all (Firefox on desktop, Safari on macOS). Telling
    // someone where the control lives is more use than a dead button.
    toast("Open this page in Chrome or Edge to install Ping, or add it to your bookmarks bar.", {
      icon: "💡",
    });
  };

  const label = needsManualInstructions ? "Add to Home Screen" : "Install app";

  const styles =
    variant === "solid"
      ? "inline-flex items-center gap-2 rounded-full bg-white border border-[#dfd5c7] px-6 py-3.5 text-sm font-bold text-[#1b2f35] transition hover:bg-[#f4efe8]"
      : "hover:text-[#1b2f35]";

  return (
    <>
      <button onClick={handleClick} className={`${styles} ${className}`}>
        {variant === "solid" && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
            />
          </svg>
        )}
        {label}
      </button>

      {showIosSheet && <IosInstallSheet onClose={() => setShowIosSheet(false)} />}
    </>
  );
}
