"use client";

import { useState, useEffect } from "react";
import { X, Search, Users, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

type Contact = {
  id: string;
  name: string;
  email: string;
  status: "online" | "offline" | "busy";
  avatar?: string;
};

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (chatId: string) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const { token } = useAuth();
  const [groupName, setGroupName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
      setGroupName("");
      setSelectedIds(new Set());
      setSearchQuery("");
      setError(null);
    }
  }, [isOpen]);

  async function fetchContacts() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setContacts(data.users || []);
    } catch {
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const filteredContacts = contacts.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleCreate() {
    if (!groupName.trim() || selectedIds.size === 0) return;

    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/chats/group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          memberIds: Array.from(selectedIds),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create group");
        return;
      }

      onGroupCreated(data.id);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-(--color-surface) rounded-2xl border border-(--color-border) shadow-2xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border)">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-(--color-primary)/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-(--color-primary)" />
            </div>
            <h2 className="text-lg font-semibold">Create Group</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-(--color-elevated) transition-colors"
          >
            <X className="h-4 w-4 text-(--color-text-muted)" />
          </button>
        </div>

        {/* Group Name */}
        <div className="px-5 pt-4">
          <label className="text-sm font-medium text-(--color-text-muted) mb-1.5 block">
            Group Name
          </label>
          <Input
            placeholder="Enter group name..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="bg-(--color-elevated) border-(--color-border) rounded-xl"
            autoFocus
          />
        </div>

        {/* Selected count */}
        {selectedIds.size > 0 && (
          <div className="px-5 pt-3">
            <div className="flex items-center gap-1.5 text-sm text-(--color-primary) font-medium">
              <Check className="h-3.5 w-3.5" />
              {selectedIds.size} member{selectedIds.size !== 1 ? "s" : ""} selected
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted)" />
            <Input
              placeholder="Search contacts..."
              className="pl-9 bg-(--color-elevated) border-none rounded-full text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 min-h-[200px] max-h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-(--color-primary)" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-(--color-text-muted)">
              <Users className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No contacts found</p>
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = selectedIds.has(contact.id);
              return (
                <div
                  key={contact.id}
                  onClick={() => toggleSelect(contact.id)}
                  className="flex items-center px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-150 hover:bg-(--color-elevated)/60"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-(--color-primary)/20 flex items-center justify-center text-(--color-primary) font-semibold text-sm">
                      {(contact.name || "?")[0].toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-(--color-surface) ${
                        contact.status === "online"
                          ? "bg-green-500"
                          : contact.status === "busy"
                          ? "bg-amber-500"
                          : "bg-gray-500"
                      }`}
                    />
                  </div>

                  {/* Info */}
                  <div className="ml-3 flex-1 overflow-hidden">
                    <h4 className="text-sm font-medium truncate">
                      {contact.name}
                    </h4>
                    <p className="text-xs text-(--color-text-muted) truncate">
                      {contact.email}
                    </p>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                      isSelected
                        ? "bg-(--color-primary) border-(--color-primary)"
                        : "border-(--color-border) hover:border-(--color-text-muted)"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-(--color-border) flex items-center justify-between gap-3">
          {error && (
            <p className="text-xs text-red-500 flex-1">{error}</p>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full px-5 bg-transparent border-(--color-border) text-(--color-text-muted) hover:bg-(--color-elevated)"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!groupName.trim() || selectedIds.size === 0 || isCreating}
              className="rounded-full px-5 bg-(--color-primary) hover:bg-(--color-primary)/90 text-white disabled:opacity-40"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Create Group
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
