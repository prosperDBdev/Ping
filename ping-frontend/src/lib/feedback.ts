import api from "@/lib/api";

/** Must match the FeedbackType enum on the backend exactly — anything else fails to bind. */
export type FeedbackType = "BUG_REPORT" | "FEATURE_REQUEST" | "GENERAL";

export const FEEDBACK_TYPES: { value: FeedbackType; label: string; hint: string }[] = [
  { value: "BUG_REPORT", label: "Something's broken", hint: "A bug or something behaving oddly" },
  { value: "FEATURE_REQUEST", label: "I have an idea", hint: "Something you'd like Ping to do" },
  { value: "GENERAL", label: "Just saying hi", hint: "Anything else on your mind" },
];

/** Same limit the backend's @Size annotation enforces. */
export const MAX_FEEDBACK_LENGTH = 5000;

export interface FeedbackInput {
  type: FeedbackType;
  message: string;
  screenshot?: File | null;
}

/**
 * Send feedback to the developer.
 *
 * Nothing identifying is sent: no username, no user id, no email. The server
 * reads all of that from the token on the request, which is the only copy that
 * can be trusted — anything this function put in the body would be a value the
 * browser chose.
 *
 * Resolves only if the server confirmed the email was accepted by the provider.
 * A rejection arrives as a thrown axios error carrying the server's own
 * user-facing message.
 */
export async function sendFeedback(input: FeedbackInput): Promise<void> {
  const formData = new FormData();
  formData.append("type", input.type);
  formData.append("message", input.message);
  if (input.screenshot) {
    formData.append("screenshot", input.screenshot, input.screenshot.name);
  }

  await api.post("/feedback", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
