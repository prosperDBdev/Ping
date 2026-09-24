"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import useAuthStore from "@/store/authStore";
import { INVITE_CODE_SHAPE, previewInvite } from "@/lib/invites";

/**
 * Where an invite link lands: /invite/<code>.
 *
 * Public. The person opening this usually has no account, which is the point.
 * It only READS: it shows who sent the invite and offers a sign-up button. The
 * attribution happens later, when the account is actually created, so nothing
 * changes just because this page was opened (or fetched by a link-preview bot).
 *
 * The sign-up button carries the invite forward as ?invite=<code>. It passes a
 * CODE, never a "return to this URL" parameter, which sidesteps the whole class
 * of open-redirect bugs: there's no address in the link for an attacker to
 * swap out for their own site.
 */
export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const code = typeof params.code === "string" ? params.code : "";
  const wellFormed = INVITE_CODE_SHAPE.test(code);
  const { isAuthenticated } = useAuthStore();

  // The code each result belongs to travels with it, so a stale answer can
  // never be shown against a different link.
  const [lookup, setLookup] = useState<{ code: string; inviter: string | null } | null>(null);

  useEffect(() => {
    if (!wellFormed) return;
    let cancelled = false;
    previewInvite(code)
      .then((inviter) => {
        if (!cancelled) setLookup({ code, inviter });
      })
      .catch(() => {
        if (!cancelled) setLookup({ code, inviter: null });
      });
    return () => {
      cancelled = true;
    };
  }, [code, wellFormed]);

  const resolved = lookup?.code === code ? lookup : null;
  const checking = wellFormed && !resolved;
  const inviter = resolved?.inviter ?? null;

  if (isAuthenticated) {
    return (
      <AuthSplitLayout
        eyebrow="You're already here"
        titleLines={[{ text: "You're" }, { text: "already", accent: true }, { text: "on Ping." }]}
        description="Invite links are for people who don't have an account yet."
      >
        <Link
          href="/chat"
          className="w-full bg-ping-dark text-white py-4 rounded-xl font-semibold hover:bg-ping-dark/90 transition flex items-center justify-center gap-2"
        >
          Go to your chats <span>→</span>
        </Link>
      </AuthSplitLayout>
    );
  }

  if (checking) {
    return (
      <AuthSplitLayout
        eyebrow="One moment"
        titleLines={[{ text: "Opening" }, { text: "your invite", accent: true }]}
        description="Checking who sent it."
      >
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-ping-teal/30 border-t-ping-teal rounded-full animate-spin" />
        </div>
      </AuthSplitLayout>
    );
  }

  if (inviter) {
    return (
      <AuthSplitLayout
        eyebrow="You're invited"
        titleLines={[{ text: `@${inviter}` }, { text: "invited you", accent: true }, { text: "to Ping." }]}
        description="A calmer place for the conversations that matter. Create your space and say hello."
      >
        <Link
          // Safe to put in the URL: the code has already matched the strict
          // 22-character shape above, so it can't carry anything else.
          href={`/auth/register?invite=${code}`}
          className="w-full bg-ping-dark text-white py-4 rounded-xl font-semibold hover:bg-ping-dark/90 transition flex items-center justify-center gap-2"
        >
          Create my space <span>→</span>
        </Link>
        <p className="mt-6 text-center text-sm text-ping-text-light">
          Already have a space?{" "}
          <Link href="/auth/login" className="text-ping-teal font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </AuthSplitLayout>
    );
  }

  // Malformed, expired, replaced, or unknown. One message for all of them,
  // matching the server, which deliberately doesn't say which.
  return (
    <AuthSplitLayout
      eyebrow="Invite unavailable"
      titleLines={[{ text: "This invite" }, { text: "has expired.", accent: true }]}
      description="Invite links last 7 days, and can be replaced by whoever sent them. You can still join Ping."
    >
      <Link
        href="/auth/register"
        className="w-full bg-ping-dark text-white py-4 rounded-xl font-semibold hover:bg-ping-dark/90 transition flex items-center justify-center gap-2"
      >
        Create my space <span>→</span>
      </Link>
    </AuthSplitLayout>
  );
}
