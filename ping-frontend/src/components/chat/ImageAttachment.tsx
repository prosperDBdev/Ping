"use client";

import { useEffect, useState } from "react";
import { fetchMediaBlobUrl } from "@/lib/media";

interface ImageAttachmentProps {
  attachmentKey: string;
  fileName: string | null;
  isMine: boolean;
}

/**
 * Renders an image attachment.
 *
 * Same constraint as the voice player: the download endpoint requires a JWT,
 * and the browser won't attach an Authorization header to an <img> element's
 * own request. So the bytes are fetched through the authenticated axios
 * instance and handed to the element as a local blob: URL.
 */
export default function ImageAttachment({ attachmentKey, fileName, isMine }: ImageAttachmentProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    fetchMediaBlobUrl(attachmentKey)
      .then((url) => {
        // The request can outlive the component (scrolling a long thread
        // unmounts bubbles freely). Without this guard we'd set state on an
        // unmounted component AND leak the object URL, since the cleanup below
        // would already have run with nothing to revoke.
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
      // Blob URLs pin their bytes in memory until explicitly revoked — without
      // this, scrolling through an image-heavy conversation would accumulate
      // every image it ever rendered.
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachmentKey]);

  if (failed) {
    return (
      <div
        className={`rounded-xl px-3 py-4 text-xs ${
          isMine ? "bg-white/10 text-white/70" : "bg-ping-cream-dark dark:bg-ping-night-card-active text-ping-text-light dark:text-ping-night-text-light"
        }`}
      >
        Couldn&apos;t load this image
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div
        className={`rounded-xl w-56 h-40 animate-pulse ${
          isMine ? "bg-white/10" : "bg-ping-cream-dark dark:bg-ping-night-card-active"
        }`}
      />
    );
  }

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="block rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-ping-teal/50"
      >
        {/* Plain <img>, not next/image: the source is a runtime blob: URL, so
            there's nothing for Next's optimizer to pre-process. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={fileName || "Shared image"}
          className="max-w-full max-h-72 object-cover"
        />
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt={fileName || "Shared image"}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}
