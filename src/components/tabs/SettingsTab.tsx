"use client";

import { useState } from "react";
import {
  Bell,
  Moon,
  Shield,
  Globe,
  Lock,
  Eye,
  Trash2,
  LogOut,
  ChevronRight,
  Smartphone,
  MessageSquare,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsTabProps {
  onLogout: () => void;
  notificationsEnabled?: boolean;
  onNotificationsToggle?: (enabled: boolean) => void;
}

export default function SettingsTab({ onLogout, notificationsEnabled = true, onNotificationsToggle }: SettingsTabProps) {
  const { user: currentUser } = useAuth();
  const [notifications, setNotifications] = useState(notificationsEnabled);
  const [messagePreview, setMessagePreview] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [encryption, setEncryption] = useState(true);

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="px-4 py-3 border-b border-(--color-border)/30">
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>

      {/* Notifications Section */}
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Notifications
        </h3>
        <div className="space-y-0">
          <SettingsRow
            icon={<Bell className="h-4 w-4" />}
            label="Push Notifications"
            description="Receive push notifications for new messages"
            trailing={
              <Toggle
                enabled={notifications}
                onToggle={() => {
                  const next = !notifications;
                  setNotifications(next);
                  onNotificationsToggle?.(next);
                }}
              />
            }
          />
          <SettingsRow
            icon={<MessageSquare className="h-4 w-4" />}
            label="Message Preview"
            description="Show message content in notifications"
            trailing={
              <Toggle
                enabled={messagePreview}
                onToggle={() => setMessagePreview(!messagePreview)}
              />
            }
          />
          <SettingsRow
            icon={<Volume2 className="h-4 w-4" />}
            label="Sound"
            description="Play sound for new messages"
            trailing={
              <Toggle
                enabled={soundEnabled}
                onToggle={() => setSoundEnabled(!soundEnabled)}
              />
            }
          />
        </div>
      </div>

      {/* Privacy Section */}
      <div className="px-4 py-3 border-t border-(--color-border)/30">
        <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Privacy
        </h3>
        <div className="space-y-0">
          <SettingsRow
            icon={<Eye className="h-4 w-4" />}
            label="Read Receipts"
            description="Let others see when you've read their messages"
            trailing={
              <Toggle
                enabled={readReceipts}
                onToggle={() => setReadReceipts(!readReceipts)}
              />
            }
          />
          <SettingsRow
            icon={<Globe className="h-4 w-4" />}
            label="Online Status"
            description="Show when you're online to others"
            trailing={
              <Toggle
                enabled={onlineStatus}
                onToggle={() => setOnlineStatus(!onlineStatus)}
              />
            }
          />
          <SettingsRow
            icon={<Lock className="h-4 w-4" />}
            label="End-to-End Encryption"
            description="Encrypt all messages by default"
            trailing={
              <Toggle
                enabled={encryption}
                onToggle={() => setEncryption(!encryption)}
              />
            }
          />
        </div>
      </div>

      {/* Appearance Section */}
      <div className="px-4 py-3 border-t border-(--color-border)/30">
        <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Appearance
        </h3>
        <div className="space-y-0">
          <SettingsRow
            icon={theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            label="Theme"
            description={theme === "dark" ? "Dark mode enabled" : "Light mode enabled"}
            trailing={
              <Toggle
                enabled={theme === "dark"}
                onToggle={toggleTheme}
              />
            }
          />
        </div>
      </div>

      {/* Account Section */}
      <div className="px-4 py-3 border-t border-(--color-border)/30">
        <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Account
        </h3>
        <div className="space-y-0">
          <SettingsRow
            icon={<Shield className="h-4 w-4" />}
            label="Blocked Users"
            description="Manage blocked contacts"
            trailing={<ChevronRight className="h-4 w-4 text-(--color-text-muted)" />}
            onClick={() => {}}
          />
          <SettingsRow
            icon={<Smartphone className="h-4 w-4" />}
            label="Connected Devices"
            description="Manage your sessions"
            trailing={<ChevronRight className="h-4 w-4 text-(--color-text-muted)" />}
            onClick={() => {}}
          />
          <SettingsRow
            icon={<Trash2 className="h-4 w-4 text-(--color-error)" />}
            label="Delete Account"
            description="Permanently delete your account"
            trailing={<ChevronRight className="h-4 w-4 text-(--color-text-muted)" />}
            onClick={() => {}}
            danger
          />
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 py-4 border-t border-(--color-border)/30">
        <Button
          variant="outline"
          className="w-full justify-center border-(--color-error) text-(--color-error) hover:bg-(--color-error)/10"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  description,
  trailing,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  trailing: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center py-3 border-b border-(--color-border)/20 last:border-b-0",
        onClick && "cursor-pointer hover:bg-(--color-surface)/50 rounded-lg px-2 -mx-2 transition-colors"
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center mr-3",
          danger
            ? "bg-(--color-error)/10 text-(--color-error)"
            : "bg-(--color-elevated) text-(--color-text-muted)"
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            danger ? "text-(--color-error)" : "text-(--color-text-primary)"
          )}
        >
          {label}
        </p>
        <p className="text-xs text-(--color-text-muted) truncate">
          {description}
        </p>
      </div>
      {trailing}
    </div>
  );
}

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "relative inline-flex h-6 w-11 rounded-full transition-colors flex-shrink-0",
        enabled ? "bg-(--color-primary)" : "bg-(--color-border)"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white transition-transform mt-0.5",
          enabled ? "translate-x-5.5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
