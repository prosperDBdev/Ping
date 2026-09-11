"use client";

import { useState } from "react";
import Sheet from "@/components/common/Sheet";
import { User } from "@/types";
import { colorFor, initialsFor } from "@/lib/avatar";

interface DurationOption {
  key: string;
  label: string;
  ms: number | null; // null = custom
}

const DURATIONS: DurationOption[] = [
  { key: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { key: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "custom", label: "Custom", ms: null },
];

interface TemporaryConversationModalProps {
  open: boolean;
  onClose: () => void;
  participant: User;
  onConfirm: (durationMs: number, label: string) => void;
  isCreating?: boolean;
}

export default function TemporaryConversationModal({
  open,
  onClose,
  participant,
  onConfirm,
  isCreating,
}: TemporaryConversationModalProps) {
  // The caller only mounts this modal while it should be open, so a fresh
  // mount is the reset signal — no effect needed to reinitialize state.
  const [step, setStep] = useState<"duration" | "confirm">("duration");
  const [selected, setSelected] = useState<string>("24h");
  const [customHours, setCustomHours] = useState(2);

  const resolvedMs =
    selected === "custom"
      ? customHours * 60 * 60 * 1000
      : DURATIONS.find((d) => d.key === selected)?.ms || 0;

  const resolvedLabel =
    selected === "custom"
      ? `${customHours} hour${customHours !== 1 ? "s" : ""}`
      : DURATIONS.find((d) => d.key === selected)?.label || "";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Temporary conversation"
      title={step === "duration" ? "How long should it last?" : "Confirm and send invite"}
      footer={
        step === "duration" ? (
          <button
            onClick={() => setStep("confirm")}
            disabled={selected === "custom" && customHours < 1}
            className="w-full py-2.5 rounded-xl bg-ping-dark dark:bg-ping-orange text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setStep("duration")}
              className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card transition"
            >
              Back
            </button>
            <button
              onClick={() => onConfirm(resolvedMs, resolvedLabel)}
              disabled={isCreating}
              className="flex-1 py-2.5 rounded-xl bg-ping-orange text-white text-sm font-semibold hover:bg-ping-orange-light transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Send invite"
              )}
            </button>
          </div>
        )
      }
    >
      {step === "duration" ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-ping-cream-dark/60 dark:bg-ping-night-card p-3">
            <div className={`w-9 h-9 rounded-full ${colorFor(participant.username)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initialsFor(participant.username)}
            </div>
            <p className="text-sm text-ping-dark dark:text-ping-night-text">
              With <span className="font-bold">{participant.username}</span>
            </p>
          </div>

          <div className="space-y-2">
            {DURATIONS.map((d) => (
              <label
                key={d.key}
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  selected === d.key
                    ? "bg-ping-sage dark:bg-ping-night-sage border-ping-sage-border dark:border-ping-night-border"
                    : "border-ping-sand dark:border-ping-night-border hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                    selected === d.key
                      ? "border-ping-teal dark:border-ping-teal-light"
                      : "border-ping-sand dark:border-ping-night-border"
                  }`}
                >
                  {selected === d.key && (
                    <span className="w-2.5 h-2.5 rounded-full bg-ping-teal dark:bg-ping-teal-light" />
                  )}
                </span>
                <input
                  type="radio"
                  name="duration"
                  value={d.key}
                  checked={selected === d.key}
                  onChange={() => setSelected(d.key)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">
                  {d.label}
                </span>
              </label>
            ))}
          </div>

          {selected === "custom" && (
            <div>
              <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
                Hours until it expires
              </label>
              <input
                type="number"
                min={1}
                max={720}
                value={customHours}
                onChange={(e) => setCustomHours(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-ping-sage dark:bg-ping-night-sage border border-ping-sage-border dark:border-ping-night-border p-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-ping-night-card flex items-center justify-center mx-auto mb-3 text-ping-teal dark:text-ping-teal-light">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-ping-dark dark:text-ping-night-text">
              Temporary conversation with {participant.username}
            </p>
            <p className="text-xs text-ping-dark/70 dark:text-ping-night-text/70 mt-1">
              Expires {resolvedLabel} after they accept
            </p>
          </div>

          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light leading-relaxed text-center px-2">
            {participant.username} has to accept before the conversation is created — the countdown
            starts then, not now. Once it expires, the conversation and its messages are deleted for
            both of you.
          </p>
        </div>
      )}
    </Sheet>
  );
}
