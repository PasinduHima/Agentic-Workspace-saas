"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The Web Speech API isn't in TypeScript's DOM types, so only the parts used here are declared.
type SpeechRecognitionResultList = ArrayLike<
  ArrayLike<{ transcript: string }> & { isFinal: boolean }
>;
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

/**
 * Dictation button: speech is transcribed and appended to `value` as you talk. Renders nothing in
 * browsers without speech recognition (Firefox, for one), so it never shows a dead button.
 */
export function MicButton({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // false on the server and on the first client render, so hydration matches.
  const supported = useSyncExternalStore(noopSubscribe, () => !!getRecognition(), () => false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop listening if the button unmounts mid-dictation.
  useEffect(() => () => recognitionRef.current?.stop(), []);

  if (!supported) return null;

  const stop = () => recognitionRef.current?.stop();

  const start = () => {
    const Recognition = getRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language;

    // Dictated text goes after whatever was already typed when dictation started.
    const base = value.trim() ? `${value.trimEnd()} ` : "";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onChange(base + transcript.trimStart());
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Microphone access is blocked. Allow it in your browser to dictate.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={listening ? stop : start}
      disabled={disabled}
      aria-label={listening ? "Stop dictation" : "Dictate"}
      aria-pressed={listening}
      className={cn(listening && "bg-primary/15 text-primary hover:bg-primary/20", className)}
    >
      {listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
    </Button>
  );
}
