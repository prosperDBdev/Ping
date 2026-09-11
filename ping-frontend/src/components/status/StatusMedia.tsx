"use client";

import { useEffect, useState } from "react";
import { fetchStatusMediaBlobUrl } from "@/lib/status";

/**
 * Renders a status image.
 *
 * The endpoint needs a JWT and a browser won't put an Authorization header on
 * an <img>'s own request, so the bytes are fetched through the authenticated
 * axios instance and given to the element as a blob: URL. That URL holds the
 * bytes in memory until it's revoked, which is why the cleanup below matters
 * more here than it would elsewhere — a status viewer pages through images
 * quickly, and leaking one per slide adds up fast.
 *
 * Callers must pass `key={mediaKey}`. This component holds per-image state and
 * has no reset path: remounting on a new key is what clears the previous
 * image, instead of an effect that wipes state on the way in and makes every
 * slide change a double render.
 */
export default function StatusMedia({ mediaKey, alt }: { mediaKey: string; alt: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    fetchStatusMediaBlobUrl(mediaKey)
      .then((url) => {
        // Paging past a slide before its bytes arrive is normal, not an edge
        // case. Without this the URL would be created after the cleanup ran
        // and never revoked.
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [mediaKey]);

  if (failed) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-white/60">
        This status is no longer available
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  /* eslint-disable-next-line @next/next/no-img-element -- a blob: URL can't go
     through next/image, which needs a real remote or static source. */
  return <img src={blobUrl} alt={alt} className="max-h-full max-w-full object-contain" />;
}
