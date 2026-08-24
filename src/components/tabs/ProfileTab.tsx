"use client";

import { useState } from "react";
import {
  Camera,
  Edit3,
  Check,
  X,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Lock,
  MessageSquare,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth, AuthUser } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type User = Omit<AuthUser, "password">;

interface ProfileTabProps {
  chats: Array<{ participants: User[] }>;
}

export default function ProfileTab({ chats }: ProfileTabProps) {
  const { user: currentUser, token } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || "");
  const [editTitle, setEditTitle] = useState(currentUser?.title || "");
  const [status, setStatus] = useState<
    "online" | "offline" | "busy"
  >(currentUser?.status || "online");

  if (!currentUser) return null;

  // Calculate stats
  const totalChats = chats.length;
  const totalContacts = new Set(
    chats.flatMap((c) => c.participants.map((p) => p.id))
  ).size - 1; // exclude self

  const handleSave = async () => {
    // TODO: Add API endpoint for updating profile
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(currentUser.name);
    setEditTitle(currentUser.title || "");
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Profile Header */}
      <div className="flex flex-col items-center px-6 py-6 border-b border-(--color-border)/30">
        <div className="relative group">
          <Avatar
            size="xl"
            status={currentUser.status}
            fallback={currentUser.name.charAt(0)}
            className="h-20 w-20 text-2xl"
          />
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </div>

        {isEditing ? (
          <div className="mt-4 w-full space-y-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-center bg-(--color-surface)"
              placeholder="Your name"
            />
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-center bg-(--color-surface)"
              placeholder="Your title"
            />
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="text-(--color-text-muted)"
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-lg font-semibold">{currentUser.name}</h2>
              <button
                onClick={() => setIsEditing(true)}
                className="text-(--color-text-muted) hover:text-(--color-primary) transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm text-(--color-text-muted)">
              {currentUser.title || "No title set"}
            </p>
          </div>
        )}
      </div>

      {/* Status Selector */}
      <div className="px-4 py-3 border-b border-(--color-border)/30">
        <p className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Status
        </p>
        <div className="flex gap-2">
          {(["online", "busy", "offline"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors flex-1 justify-center",
                status === s
                  ? "bg-(--color-primary)/10 text-(--color-primary) border border-(--color-primary)/30"
                  : "bg-(--color-elevated) text-(--color-text-muted) border border-transparent hover:bg-(--color-border)"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  s === "online" && "bg-green-500",
                  s === "busy" && "bg-amber-500",
                  s === "offline" && "bg-gray-500"
                )}
              />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="px-4 py-3 border-b border-(--color-border)/30">
        <p className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Information
        </p>
        <div className="space-y-3">
          <InfoRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={currentUser.email || "No email"}
          />
          <InfoRow
            icon={<Shield className="h-4 w-4" />}
            label="Account"
            value={currentUser.isVerified ? "Verified" : "Unverified"}
            badge={currentUser.isVerified}
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-4 py-3 border-b border-(--color-border)/30">
        <p className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Activity
        </p>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<MessageSquare className="h-4 w-4" />}
            value={totalChats}
            label="Chats"
          />
          <StatCard
            icon={<Lock className="h-4 w-4" />}
            value={totalContacts}
            label="Contacts"
          />
          <StatCard
            icon={<Shield className="h-4 w-4" />}
            value={currentUser.isVerified ? "Yes" : "No"}
            label="Verified"
          />
        </div>
      </div>

      {/* Security Section */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">
          Security
        </p>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start text-sm"
          >
            <Lock className="mr-2 h-4 w-4" /> Change Password
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-sm"
          >
            <Shield className="mr-2 h-4 w-4" /> Two-Factor Authentication
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center">
      <div className="h-8 w-8 rounded-lg bg-(--color-elevated) flex items-center justify-center mr-3 text-(--color-text-muted)">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs text-(--color-text-muted)">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-sm">{value}</p>
          {badge !== undefined && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                badge
                  ? "bg-(--color-primary)/10 text-(--color-primary)"
                  : "bg-(--color-elevated) text-(--color-text-muted)"
              )}
            >
              {badge ? "✓ Verified" : "Unverified"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="bg-(--color-elevated) rounded-lg p-3 text-center">
      <div className="flex justify-center mb-1 text-(--color-text-muted)">
        {icon}
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-(--color-text-muted)">{label}</p>
    </div>
  );
}
