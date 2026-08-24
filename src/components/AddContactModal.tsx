"use client";

import { useState, useCallback } from "react";
import { X, Search, Phone, MessageSquare, UserPlus, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { CountryCode } from "@/lib/countryCodes";

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

type SearchState = "idle" | "searching" | "found" | "not_found" | "error";

interface FoundUser {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  avatar_url: string | null;
  status: string;
}

export default function AddContactModal({ isOpen, onClose, onChatCreated }: AddContactModalProps) {
  const { token } = useAuth();
  const [dialCode, setDialCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const fullPhone = `${dialCode}${phoneNumber.replace(/\s/g, "")}`;

  const handleSearch = useCallback(async () => {
    if (!phoneNumber.trim() || !token) return;

    setSearchState("searching");
    setError("");
    setFoundUser(null);

    try {
      // Search through all users for a matching phone number
      const response = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to search users");

      const data = await response.json();
      const normalizedSearch = fullPhone.replace(/\s/g, "").toLowerCase();

      const match = data.users.find((u: FoundUser) => {
        const normalizedUserPhone = (u.phone_number || "").replace(/\s/g, "").toLowerCase();
        return normalizedUserPhone === normalizedSearch;
      });

      if (match) {
        setFoundUser(match);
        setSearchState("found");
      } else {
        setSearchState("not_found");
      }
    } catch (err) {
      console.error("Search failed:", err);
      setError("Failed to search for user. Please try again.");
      setSearchState("error");
    }
  }, [phoneNumber, fullPhone, token]);

  const handleStartChat = useCallback(async () => {
    if (!foundUser || !token) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/chats/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: foundUser.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create chat");
      }

      const data = await response.json();
      onChatCreated(data.chat.id);
      handleClose();
    } catch (err: any) {
      console.error("Create chat failed:", err);
      setError(err.message || "Failed to start chat");
    } finally {
      setIsCreating(false);
    }
  }, [foundUser, token, onChatCreated]);

  const handleClose = () => {
    setPhoneNumber("");
    setSearchState("idle");
    setFoundUser(null);
    setError("");
    setIsCreating(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && phoneNumber.trim() && searchState !== "searching") {
      handleSearch();
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-(--color-surface) border border-(--color-border) rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--color-border)">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-(--color-primary)/20 rounded-full flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-(--color-primary)" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Add Contact</h2>
              <p className="text-xs text-(--color-text-muted)">Find someone by their phone number</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Phone input */}
          <div>
            <label className="text-xs font-medium text-(--color-text-muted) uppercase tracking-wider mb-2 block">
              Phone Number
            </label>
            <div className="flex items-center gap-2">
              <CountryCodeSelect
                value={dialCode}
                onChange={(dial: string) => setDialCode(dial)}
              />
              <Input
                placeholder="234 567 8900"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (searchState !== "idle") setSearchState("idle");
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-(--color-background) border-(--color-border) text-sm"
                disabled={searchState === "searching"}
              />
            </div>
            {fullPhone && (
              <p className="text-xs text-(--color-text-muted) mt-1.5">
                Searching for <span className="text-(--color-text-primary) font-medium">{fullPhone}</span>
              </p>
            )}
          </div>

          {/* Search button */}
          {searchState !== "found" && (
            <Button
              onClick={handleSearch}
              disabled={!phoneNumber.trim() || searchState === "searching"}
              className="w-full bg-(--color-primary) hover:bg-(--color-primary)/90 text-white"
            >
              {searchState === "searching" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-(--color-error)/10 border border-(--color-error)/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-(--color-error) shrink-0" />
              <p className="text-sm text-(--color-error)">{error}</p>
            </div>
          )}

          {/* Not found */}
          {searchState === "not_found" && (
            <div className="text-center py-6">
              <div className="h-16 w-16 bg-(--color-elevated) rounded-full flex items-center justify-center mx-auto mb-3">
                <Phone className="h-7 w-7 text-(--color-text-muted)" />
              </div>
              <p className="text-sm font-medium mb-1">User not found</p>
              <p className="text-xs text-(--color-text-muted) max-w-xs mx-auto">
                No ChatX account is registered with <span className="font-medium">{fullPhone}</span>.
                They&apos;ll need to sign up first.
              </p>
            </div>
          )}

          {/* Found user */}
          {searchState === "found" && foundUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-(--color-primary)/10 border border-(--color-primary)/20 rounded-lg">
                <CheckCircle className="h-4 w-4 text-(--color-primary) shrink-0" />
                <p className="text-sm text-(--color-primary) font-medium">User found!</p>
              </div>

              <div className="flex items-center gap-4 p-4 bg-(--color-elevated) rounded-xl">
                <Avatar
                  size="lg"
                  status={foundUser.status as "online" | "offline" | "busy"}
                  fallback={foundUser.name?.charAt(0) || "?"}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold truncate">{foundUser.name}</h3>
                  <p className="text-sm text-(--color-text-muted) truncate">{foundUser.phone_number}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        foundUser.status === "online" ? "bg-green-500" : "bg-gray-400"
                      )}
                    />
                    <span className="text-xs text-(--color-text-muted) capitalize">{foundUser.status}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchState("idle");
                    setFoundUser(null);
                    setPhoneNumber("");
                  }}
                  className="flex-1"
                >
                  Search Another
                </Button>
                <Button
                  onClick={handleStartChat}
                  disabled={isCreating}
                  className="flex-1 bg-(--color-primary) hover:bg-(--color-primary)/90 text-white"
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Start Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
