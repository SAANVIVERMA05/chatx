"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioMessageProps {
  src: string;
  duration?: number;
  isMine: boolean;
}

export default function AudioMessage({ src, duration, isMine }: AudioMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration || 1;
    setProgress((current / total) * 100);
    setCurrentTime(current);
    animationRef.current = requestAnimationFrame(updateProgress);
  }, []);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        cancelAnimationFrame(animationRef.current);
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
      cancelAnimationFrame(animationRef.current);
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        animationRef.current = requestAnimationFrame(updateProgress);
      } catch (err) {
        console.error("Failed to play audio:", err);
      }
    }
  }, [isPlaying, src, updateProgress]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center space-x-3 min-w-[200px]">
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isMine
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-(--color-primary)/10 hover:bg-(--color-primary)/20 text-(--color-primary)"
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" fill="currentColor" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Waveform progress bar */}
      <div className="flex-1 flex flex-col space-y-1">
        {/* Progress track */}
        <div className="relative h-1.5 rounded-full overflow-hidden"
          style={{
            backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "var(--color-border)",
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
            style={{
              width: `${progress}%`,
              backgroundColor: isMine ? "white" : "var(--color-primary)",
            }}
          />
        </div>

        {/* Time */}
        <div className="flex justify-between">
          <span className={cn(
            "text-[10px] tabular-nums",
            isMine ? "text-white/70" : "text-(--color-text-muted)"
          )}>
            {formatTime(currentTime)}
          </span>
          {duration !== undefined && (
            <span className={cn(
              "text-[10px] tabular-nums",
              isMine ? "text-white/70" : "text-(--color-text-muted)"
            )}>
              {formatTime(duration)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
