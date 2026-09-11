"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ping-sidebar-width";

interface Options {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

/**
 * Drag-to-resize for the conversation list.
 *
 * Width is clamped and persisted, so the divider can't be dragged somewhere
 * unusable and the choice survives a reload.
 */
export default function useResizableSidebar({ defaultWidth, minWidth, maxWidth }: Options) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Read the stored width after mount rather than in the initializer: this
  // component renders on the server too, where localStorage doesn't exist, and
  // seeding from it during render would make the first client paint disagree
  // with the server's HTML.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(Math.min(maxWidth, Math.max(minWidth, parsed)));
    }
  }, [minWidth, maxWidth]);

  const startDragging = useCallback(() => {
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      // Measured from the viewport's left edge, which is where the sidebar
      // starts on desktop (the nav rail sits inside this measurement, so the
      // min width accounts for it).
      e.preventDefault();
      setWidth(Math.min(maxWidth, Math.max(minWidth, e.clientX)));
    };

    const onUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      // Persist on release rather than on every mousemove — otherwise this
      // writes to localStorage dozens of times a second while dragging.
      setWidth((current) => {
        window.localStorage.setItem(STORAGE_KEY, String(current));
        return current;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minWidth, maxWidth]);

  // Keyboard resizing, so the divider isn't mouse-only.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 40 : 16;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setWidth((w) => {
          const next = Math.max(minWidth, w - step);
          window.localStorage.setItem(STORAGE_KEY, String(next));
          return next;
        });
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setWidth((w) => {
          const next = Math.min(maxWidth, w + step);
          window.localStorage.setItem(STORAGE_KEY, String(next));
          return next;
        });
      }
    },
    [minWidth, maxWidth]
  );

  return { width, isDragging, startDragging, onKeyDown };
}
