"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MessageSquare, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import AddContactModal from "@/components/AddContactModal";

type Contact = {
  id: string;
  name: string;
  email: string;
  status: "online" | "offline" | "busy";
  lastSeen?: string;
  isVerified?: boolean;
  title?: string;
};

interface ContactsTabProps {
  onOpenChat: (chatId: string) => void;
  onChatCreated?: (chatId: string) => void;
}

export default function ContactsTab({ onOpenChat, onChatCreated }: ContactsTabProps) {
  const { token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setContacts(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  const onlineContacts = filteredContacts.filter((c) => c.status === "online");
  const offlineContacts = filteredContacts.filter(
    (c) => c.status !== "online"
  );

  const handleStartChat = async (contactId: string) => {
    onOpenChat(contactId);
  };

  const handleChatCreated = (chatId: string) => {
    if (onChatCreated) {
      onChatCreated(chatId);
    } else {
      onOpenChat(chatId);
    }
    fetchContacts();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted)" />
          <Input
            placeholder="Search contacts..."
            className="pl-9 bg-(--color-surface) border-none rounded-full text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Add Contact Button */}
      <div className="px-4 pb-2">
        <Button
          className="w-full justify-center text-sm bg-(--color-elevated) hover:bg-(--color-border) text-white rounded-full"
          variant="outline"
          onClick={() => setShowAddContact(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add Contact
        </Button>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Online Section */}
        {onlineContacts.length > 0 && (
          <div>
            <p className="px-4 py-2 text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">
              Online — {onlineContacts.length}
            </p>
            {onlineContacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                onClick={() => handleStartChat(contact.id)}
              />
            ))}
          </div>
        )}

        {/* Offline Section */}
        {offlineContacts.length > 0 && (
          <div>
            <p className="px-4 py-2 text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">
              Offline — {offlineContacts.length}
            </p>
            {offlineContacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                onClick={() => handleStartChat(contact.id)}
              />
            ))}
          </div>
        )}

        {filteredContacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-(--color-text-muted)">
            <Search className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No contacts found</p>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        onChatCreated={handleChatCreated}
      />
    </div>
  );
}

function ContactItem({
  contact,
  onClick,
}: {
  contact: Contact;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center px-4 py-3 cursor-pointer transition-colors duration-150 border-b border-(--color-border)/30 hover:bg-(--color-surface)/50"
    >
      <Avatar
        size="md"
        status={contact.status}
        fallback={contact.name.charAt(0)}
      />
      <div className="ml-4 flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">{contact.name}</h3>
          {contact.isVerified && (
            <span className="text-(--color-primary) text-xs">✓</span>
          )}
        </div>
        <p className="text-xs text-(--color-text-muted) truncate">
          {contact.title || contact.email}
        </p>
        {contact.status === "offline" && contact.lastSeen && (
          <p className="text-xs text-(--color-text-muted) mt-0.5">
            Last seen {contact.lastSeen}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-(--color-primary) transition-all"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
    </div>
  );
}
