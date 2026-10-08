"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import PingLogo from "@/components/common/PingLogo";
import { GROUP_CODE_SHAPE, GroupInvite, joinGroup, previewGroupInvite } from "@/lib/groups";
import { apiErrorMessage } from "@/lib/messages";
import useChatStore from "@/store/chatStore";

type Phase = "checking" | "ready" | "joining" | "joined" | "invalid";

/**
 * "Join <group>" for someone sent a group invite link.
 *
 * The code sits after the #, so it isn't sent to our server or written to an
 * access log just by the page loading. It's then posted explicitly to join.
 */
function GroupInviteJoin() {
  const router = useRouter();
  // Read once, and only in the browser: ProtectedRoute shows a spinner until
  // the sign-in check has run, so window exists by the time this renders.
  const [code] = useState(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    return decodeURIComponent(fromHash);
  });
  const [phase, setPhase] = useState<Phase>(() => (GROUP_CODE_SHAPE.test(code) ? "checking" : "invalid"));
  const [invite, setInvite] = useState<GroupInvite | null>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    // Take the code out of the address bar, so it isn't left in history.
    window.history.replaceState(null, "", window.location.pathname);
    if (!GROUP_CODE_SHAPE.test(code)) {
      setProblem("That isn't a Ping group link.");
      return;
    }
    previewGroupInvite(code)
      .then((i) => {
        setInvite(i);
        setPhase("ready");
      })
      .catch((err) => {
        setProblem(apiErrorMessage(err, "This group link is invalid or has expired"));
        setPhase("invalid");
      });
  }, [code]);

  const join = async () => {
    setPhase("joining");
    try {
      const conversation = await joinGroup(code);
      // Put it in the list straight away, so the redirect shows the group
      // instead of an empty inbox while the chat page fetches.
      useChatStore.getState().upsertConversation(conversation);
      setPhase("joined");
      toast.success(`You joined "${conversation.name ?? "the group"}"`);
      setTimeout(() => router.push(`/chat?open=${conversation.id}`), 900);
    } catch (err) {
      setProblem(apiErrorMessage(err, "Couldn't join this group"));
      setPhase("invalid");
    }
  };

  return (
    <div className="min-h-dvh bg-ping-cream dark:bg-ping-night-bg flex flex-col items-center px-4 py-8">
      <Toaster position="top-center" />
      <PingLogo />
      <div className="w-full max-w-sm mt-10 bg-white dark:bg-ping-night-card rounded-3xl border border-ping-sand/60 dark:border-ping-night-border p-6">
        {phase === "checking" || phase === "joining" ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
          </div>
        ) : phase === "ready" && invite ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-teal dark:text-ping-teal-light mb-2">
              Group invite
            </p>
            <h1 className="text-2xl font-black text-ping-dark dark:text-ping-night-text leading-tight mb-2 break-words">
              Join &ldquo;{invite.groupName}&rdquo;?
            </h1>
            <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mb-5">
              {invite.inviterUsername} invited you. {invite.memberCount}{" "}
              {invite.memberCount === 1 ? "person is" : "people are"} already in it.
            </p>
            <button
              onClick={() => void join()}
              className="w-full py-3 rounded-xl bg-ping-dark text-white font-semibold hover:bg-ping-dark/90 transition"
            >
              Join group
            </button>
            <button
              onClick={() => router.push("/chat")}
              className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold text-ping-text-light dark:text-ping-night-text-light hover:text-ping-dark dark:hover:text-ping-night-text transition"
            >
              Not now
            </button>
          </>
        ) : phase === "joined" ? (
          <div className="text-center py-4">
            <p className="text-3xl mb-3">🎉</p>
            <p className="text-lg font-bold text-ping-dark dark:text-ping-night-text">You&apos;re in</p>
            <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mt-1">Opening the group…</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-3xl mb-3">⌛</p>
            <h1 className="text-lg font-bold text-ping-dark dark:text-ping-night-text mb-1">
              This link can&apos;t be used
            </h1>
            <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mb-5">
              {problem || "It may have expired, or the group may have been deleted."}
            </p>
            <button
              onClick={() => router.push("/chat")}
              className="text-sm font-bold text-ping-teal dark:text-ping-teal-light hover:underline"
            >
              Go to your chats
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupInvitePage() {
  return (
    <ProtectedRoute>
      <GroupInviteJoin />
    </ProtectedRoute>
  );
}
