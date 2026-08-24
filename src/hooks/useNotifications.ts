"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export function useNotifications(enabled: boolean) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const onClickRef = useRef<(() => void) | null>(null);

  // Check support and current permission on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  // Send a notification
  const sendNotification = useCallback(
    (options: NotificationOptions) => {
      if (!enabled || !isSupported || permission !== "granted") return;
      if (typeof document !== "undefined" && document.visibilityState === "visible") return;

      onClickRef.current = options.onClick || null;

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || "/favicon.ico",
          tag: options.tag || "chatx-message",
          requireInteraction: false,
        });

        notification.onclick = () => {
          window.focus();
          onClickRef.current?.();
          notification.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      } catch {
        // Notification failed silently
      }
    },
    [enabled, isSupported, permission]
  );

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
  };
}
