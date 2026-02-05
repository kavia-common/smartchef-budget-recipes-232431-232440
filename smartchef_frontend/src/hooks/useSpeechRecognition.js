import { useEffect, useMemo, useRef, useState } from "react";

function getSpeechApi() {
  const w = typeof window !== "undefined" ? window : undefined;
  return w?.SpeechRecognition || w?.webkitSpeechRecognition;
}

/**
 * PUBLIC_INTERFACE
 * Hook for speech-to-text via the Web Speech API (when available).
 * @returns {{
 *  supported: boolean,
 *  listening: boolean,
 *  transcript: string,
 *  error: string|null,
 *  start: () => void,
 *  stop: () => void,
 *  reset: () => void
 * }}
 */
export function useSpeechRecognition() {
  const SpeechRecognition = useMemo(() => getSpeechApi(), []);
  const supported = Boolean(SpeechRecognition);

  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supported) return;

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const text = res?.[0]?.transcript || "";
        if (res.isFinal) finalText += text;
        else interimText += text;
      }

      const next = [transcript, finalText, interimText].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      setTranscript(next);
    };

    recog.onerror = (e) => {
      setError(e?.error || "speech_error");
      setListening(false);
    };

    recog.onend = () => {
      setListening(false);
    };

    recogRef.current = recog;
    return () => {
      try {
        recog.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const start = () => {
    if (!recogRef.current) return;
    setError(null);
    setListening(true);
    try {
      recogRef.current.start();
    } catch {
      // Some browsers throw if already started
    }
  };

  const stop = () => {
    if (!recogRef.current) return;
    try {
      recogRef.current.stop();
    } catch {
      // ignore
    }
    setListening(false);
  };

  const reset = () => setTranscript("");

  return { supported, listening, transcript, error, start, stop, reset };
}
