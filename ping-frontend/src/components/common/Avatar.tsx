"use client";

import { useEffect, useState } from "react";
import { fetchAvatarBlobUrl } from "@/lib/profile";
import { initialsFor } from "@/lib/avatar";

interface AvatarProps {
  username?: string | null;
  /**
   * The stored avatar URL, or null when this user has no photo. A local
   * "blob:"/"data:" URL is also accepted, for previewing a file that hasn't
   * been uploaded yet.
   */
  avatarUrl?: string | null;
  /** Sizing and shape, e.g. "w-20 h-20". */
  className?: string;
  /** Font sizing for the initials fallback. */
  textClassName?: string;
  /** Background for the initials fallback. */
  fallbackClassName?: string;
}

const isLocal = (url: string) => url.startsWith("blob:") || url.startsWith("data:");

/**
 * A user's profile photo, falling back to their initials.
 *
 * The fallback isn't only for "no photo set" — it's also what shows while the
 * bytes are in flight and if the fetch fails. An avatar that can't load should
 * look like a person without a picture, not like a broken image.
 *
 * WHY THE FETCHED URL IS STORED WITH THE URL IT CAME FROM. The obvious version
 * of this component clears the old image at the top of the effect when
 * avatarUrl changes. That means calling setState in the effect body, which
 * React warns about because it causes a second render pass every time. Keeping
 * the source URL alongside the fetched one removes the need: a result is only
 * used while it still matches the avatarUrl being asked for, so a stale image
 * from the previous URL is ignored rather than cleared.
 */
export default function Avatar({
  username,
  avatarUrl,
  className = "w-10 h-10",
  textClassName = "text-sm",
  fallbackClassName = "bg-ping-dark dark:bg-ping-night-card-active",
}: AvatarProps) {
  const [fetched, setFetched] = useState<{ from: string; url: string } | null>(null);

  useEffect(() => {
    // Nothing to fetch: either there's no photo, or the bytes are already in
    // the browser as a local preview whose lifetime belongs to its creator.
    if (!avatarUrl || isLocal(avatarUrl)) return;

    let cancelled = false;
    let createdUrl: string | null = null;

    fetchAvatarBlobUrl(avatarUrl)
      .then((url) => {
        // The request can outlive the component — a list of users scrolls and
        // unmounts rows freely. Without this the object URL would leak, since
        // the cleanup below would already have run with nothing to revoke.
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setFetched({ from: avatarUrl, url });
      })
      .catch(() => {
        // Nothing to set: with no matching result, the initials show. There's
        // nothing useful to tell someone about a picture that didn't load.
      });

    return () => {
      cancelled = true;
      // Blob URLs pin their bytes in memory until revoked.
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // Re-runs when the URL's ?v= changes, which is exactly when the photo has
    // been replaced.
  }, [avatarUrl]);

  const src = !avatarUrl
    ? null
    : isLocal(avatarUrl)
      ? avatarUrl
      : fetched?.from === avatarUrl
        ? fetched.url
        : null;

  if (src) {
    return (
      // Plain <img>, not next/image: the source is a runtime blob: URL, so
      // there is nothing for Next's optimizer to pre-process.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={username ? `${username}'s profile photo` : "Profile photo"}
        className={`${className} rounded-full object-cover`}
      />
    );
  }

  const initials = initialsFor(username);

  return (
    <div
      className={`${className} ${fallbackClassName} ${textClassName} rounded-full text-white flex items-center justify-center font-bold`}
      aria-label={username ? `${username}'s initials` : undefined}
    >
      {initials === "?" ? "U" : initials}
    </div>
  );
}
