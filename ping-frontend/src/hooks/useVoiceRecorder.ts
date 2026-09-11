"use client";

import { useCallback, useRef, useState } from "react";

export interface VoiceRecordingResult {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

interface UseVoiceRecorderOptions {
  maxDurationSeconds: number;
  onRecordingComplete: (result: VoiceRecordingResult) => void;
}

// Browsers disagree on which audio codecs MediaRecorder can produce. Ask for
// the first one it actually supports rather than hardcoding one and hoping.
function pickSupportedMimeType(): string {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return ""; // let the browser pick its own default
}

/**
 * Wraps the browser's MediaRecorder API into start/stop/cancel controls.
 *
 * The recorder doesn't hand you one finished audio file — while recording, it
 * fires small chunks of encoded data as they become available. You collect
 * those chunks in an array, and only once recording stops do you glue them
 * together (`new Blob(chunks, ...)`) into the actual playable file.
 */
export default function useVoiceRecorder({
  maxDurationSeconds,
  onRecordingComplete,
}: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Stopping the recorder does NOT release the microphone by itself — the
    // browser keeps the mic indicator lit until every track on the stream is
    // explicitly stopped. Skipping this is a real, easy-to-miss leak.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setElapsedSeconds(0);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const mimeType = pickSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      // Declared here (not as React state read inside onstop below) on purpose —
      // see the explanation where this hook is introduced.
      let seconds = 0;

      recorder.onstop = () => {
        const finalMimeType = mimeTypeRef.current || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        const durationSeconds = seconds;
        cleanup();

        if (!cancelledRef.current && blob.size > 0) {
          onRecordingComplete({ blob, mimeType: finalMimeType, durationSeconds });
        }
      };

      recorder.start();
      setIsRecording(true);

      intervalRef.current = setInterval(() => {
        seconds += 1;
        setElapsedSeconds(seconds);
        if (seconds >= maxDurationSeconds) {
          recorder.stop(); // auto-stop at the cap — onstop fires exactly as if the user tapped stop
        }
      }, 1000);
    } catch {
      // Most commonly: the user denied mic permission, or no mic is available.
      setError("Couldn't access your microphone. Check your browser's permission for this site.");
      cleanup();
    }
  }, [cleanup, maxDurationSeconds, onRecordingComplete]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    mediaRecorderRef.current?.stop();
  }, []);

  return { isRecording, elapsedSeconds, error, start, stop, cancel };
}
