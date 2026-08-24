"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [analyserData, setAnalyserData] = useState<number[]>(new Array(28).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);

  // Keep durationRef in sync
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  const stopAll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Set up Web Audio API for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setDuration(0);

      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 200);

      // Start visualization
      const updateVisualizer = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Take 28 bars from the frequency data
        const bars = 28;
        const step = Math.floor(dataArray.length / bars);
        const newValues: number[] = [];
        for (let i = 0; i < bars; i++) {
          // Average a few frequency bins for smoother visualization
          const start = i * step;
          let sum = 0;
          for (let j = start; j < start + step && j < dataArray.length; j++) {
            sum += dataArray[j];
          }
          newValues.push(sum / step / 255); // Normalize to 0-1
        }
        setAnalyserData(newValues);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };

      animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    } catch (err) {
      console.error("Failed to start recording:", err);
      onCancel();
    }
  }, [onCancel]);

  const stopRecording = useCallback(() => {
    return new Promise<{ blob: Blob; duration: number }>((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        resolve({ blob: new Blob(), duration: 0 });
        return;
      }

      const dur = durationRef.current;
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stopAll();
        setAnalyserData(new Array(28).fill(0));
        resolve({ blob, duration: dur });
      };

      mediaRecorderRef.current.stop();
    });
  }, [stopAll]);

  const handleSend = useCallback(async () => {
    const { blob, duration } = await stopRecording();
    if (blob.size > 0) {
      onSend(blob, duration);
    }
  }, [stopRecording, onSend]);

  const handleCancel = useCallback(() => {
    stopAll();
    setIsRecording(false);
    setDuration(0);
    setAnalyserData(new Array(28).fill(0));
    onCancel();
  }, [stopAll, onCancel]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      handleSend();
    } else {
      startRecording();
    }
  }, [isRecording, handleSend, startRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start recording immediately on mount
  useEffect(() => {
    startRecording();
  }, []);

  return (
    <div className="flex items-center space-x-2 bg-(--color-background) rounded-full px-3 py-2 border border-(--color-border) focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500/20 transition-all">
      {/* Cancel button */}
      <button
        onClick={handleCancel}
        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-red-500/10 transition-colors text-red-500"
        title="Cancel recording"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {/* Recording indicator + waveform */}
      <div className="flex-1 flex items-center space-x-3">
        {/* Pulsing red dot */}
        <div className="relative">
          <div className="h-3 w-3 bg-red-500 rounded-full" />
          {isRecording && (
            <div className="absolute inset-0 h-3 w-3 bg-red-500 rounded-full animate-ping opacity-75" />
          )}
        </div>

        {/* Waveform visualization */}
        <div className="flex-1 flex items-center justify-center space-x-px h-8">
          {analyserData.map((value, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, value * 32)}px`,
                backgroundColor: isRecording
                  ? `hsl(${0 + i * 2}, 80%, ${50 + value * 20}%)`
                  : "var(--color-text-muted)",
                opacity: 0.5 + value * 0.5,
              }}
            />
          ))}
        </div>

        {/* Duration */}
        <span className="text-sm font-mono text-red-500 tabular-nums min-w-[3rem] text-right">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!isRecording || duration === 0}
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-full transition-all",
          isRecording && duration > 0
            ? "bg-(--color-primary) text-white hover:bg-(--color-primary)/90"
            : "bg-(--color-elevated) text-(--color-text-muted)"
        )}
        title="Send voice message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
