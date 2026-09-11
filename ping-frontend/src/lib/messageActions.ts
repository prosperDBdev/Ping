/**
 * Lightweight, local heuristics that decide which "turn this into..."
 * shortcuts to surface for a given message. Nothing here calls a model —
 * it's just keyword/pattern matching so the message action menu can
 * highlight the most likely action instead of showing every option with
 * equal weight.
 */

const TASK_HINTS = /\b(fix|bug|please|todo|to-do|need to|can you|task|finish|complete|handle|resolve|update|implement)\b/i;
const EVENT_HINTS = /\b(meeting|call|sync|standup|catch up|event|at \d{1,2}(:\d{2})?\s?(am|pm)?|on (mon|tue|wed|thu|fri|sat|sun))\b/i;
const REMINDER_HINTS = /\b(remember|don'?t forget|reminder|remind me|submit|deadline|due)\b/i;

export interface SuggestedActions {
  task: boolean;
  event: boolean;
  reminder: boolean;
}

export function suggestActionsForMessage(content: string): SuggestedActions {
  return {
    task: TASK_HINTS.test(content),
    event: EVENT_HINTS.test(content),
    reminder: REMINDER_HINTS.test(content) && !EVENT_HINTS.test(content),
  };
}

export function snippetFor(content: string, maxLength = 80): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength - 1).trimEnd() + "…";
}

/**
 * Reply-quoting without a backend schema change.
 *
 * The Message model has no `replyToMessageId` field, so a quoted reply is
 * encoded as a JSON header on its own line, followed by the actual text.
 * It travels through the existing send/broadcast/persist path unchanged
 * and renders as a real quote block for this client; a message sent this
 * way still reads fine as plain text anywhere else.
 */

interface ReplyQuoteHeader {
  __replyTo: { sender: string; snippet: string };
}

export function buildReplyQuote(sender: string, snippet: string, body: string): string {
  const header: ReplyQuoteHeader = { __replyTo: { sender, snippet } };
  return `${JSON.stringify(header)}\n${body}`;
}

export function parseReplyQuote(content: string): {
  quoted: { sender: string; snippet: string } | null;
  body: string;
} {
  const newlineIndex = content.indexOf("\n");
  if (newlineIndex === -1) return { quoted: null, body: content };

  const firstLine = content.slice(0, newlineIndex);
  try {
    const parsed = JSON.parse(firstLine) as Partial<ReplyQuoteHeader>;
    if (parsed.__replyTo?.sender && typeof parsed.__replyTo.snippet === "string") {
      return { quoted: parsed.__replyTo, body: content.slice(newlineIndex + 1) };
    }
  } catch {
    // Not a reply-quote header — fall through and treat as plain content.
  }
  return { quoted: null, body: content };
}
