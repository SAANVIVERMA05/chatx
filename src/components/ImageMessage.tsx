"use client";

import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageMessageProps {
  src: string;
  alt?: string;
  isMine: boolean;
  onClick?: () => void;
}

export default function ImageMessage({ src, alt, isMine, onClick }: ImageMessageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    // Fallback to file card if image fails to load
    return (
      <div className="flex items-center space-x-3 bg-black/20 p-3 rounded-lg">
        <div className="h-10 w-10 bg-white/10 rounded flex items-center justify-center">
          <ImageIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-sm">{alt || "Image"}</p>
          <p className="text-xs opacity-70">Failed to load</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative cursor-pointer group overflow-hidden rounded-xl"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="w-64 h-48 bg-black/10 rounded-xl flex items-center justify-center animate-pulse">
          <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
        </div>
      )}

      {/* Image */}
      <img
        src={src}
        alt={alt || "Image"}
        className={cn(
          "max-w-64 max-h-64 rounded-xl object-cover transition-opacity duration-200",
          isLoaded ? "opacity-100" : "opacity-0 absolute"
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
      />

      {/* Hover overlay */}
      {isLoaded && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-black/50 rounded-full p-2">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
