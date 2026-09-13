"use client";

import { Status } from "@/types";

interface StatusRingProps {
  statuses: Status[];
  label: string;
  /** Pixel size of the whole ring, avatar included. */
  size?: number;
  /** Force every segment to render as seen — used for your own statuses. */
  allSeen?: boolean;
}

/**
 * The segmented ring around an avatar — one arc per status.
 *
 * Segments rather than a single ring because the ring is information, not
 * decoration: it tells you at a glance how many updates someone posted and
 * which of them you haven't opened. A solid ring can only say "something is
 * new"; three orange arcs and a grey one says "three new, one seen".
 *
 * Drawn with SVG stroke-dasharray. Each segment is an arc of the circle's
 * circumference minus a small gap, offset so the first starts at 12 o'clock.
 * The circle is rotated -90deg because SVG starts circles at 3 o'clock.
 *
 * The centre shows the latest status's own colour for a text post, so a ring
 * previews what's waiting before you open it.
 */
export default function StatusRing({ statuses, label, size = 52, allSeen = false }: StatusRingProps) {
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const count = Math.max(statuses.length, 1);
  // No gaps for a single status — a ring with one tiny gap looks broken.
  const gap = count === 1 ? 0 : Math.min(6, circumference / count / 3);
  const segment = circumference / count - gap;

  const latest = statuses[statuses.length - 1];
  const centreColour =
    latest?.type === "TEXT" && latest.backgroundColor ? latest.backgroundColor : undefined;

  const initials = label
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const inset = stroke + 2.5;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {statuses.map((s, i) => {
          const seen = allSeen || s.viewed;
          return (
            <circle
              key={s.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap={count === 1 ? "butt" : "round"}
              className={seen ? "stroke-ping-sand dark:stroke-ping-night-border" : "stroke-ping-orange"}
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={-i * (segment + gap)}
            />
          );
        })}
      </svg>
      <div
        className={`absolute rounded-full flex items-center justify-center text-white font-bold text-xs ${
          centreColour ? "" : "bg-slate-400 dark:bg-slate-600"
        }`}
        style={{
          inset,
          ...(centreColour ? { backgroundColor: centreColour } : {}),
        }}
      >
        {initials}
      </div>
    </div>
  );
}
