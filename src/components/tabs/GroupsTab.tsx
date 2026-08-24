"use client";

import { useState } from "react";
import { Search, Users, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import CreateGroupModal from "@/components/CreateGroupModal";

type User = {
  id: string;
  name: string;
  email: string;
  status: "online" | "offline" | "busy";
  title?: string;
};

type Message = {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
};

type GroupChat = {
  id: string;
  type: "group";
  name: string;
  avatar?: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  isEncrypted: boolean;
};

interface GroupsTabProps {
  chats: GroupChat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onGroupCreated?: (chatId: string) => void;
}

export default function GroupsTab({
  chats,
  selectedChatId,
  onSelectChat,
  onGroupCreated,
}: GroupsTabProps) {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const groupChats = chats.filter((c) => c.type === "group");
  const filteredGroups = groupChats.filter(
    (g) =>
      g.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.participants.some((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted)" />
          <Input
            placeholder="Search groups..."
            className="pl-9 bg-(--color-surface) border-none rounded-full text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Create Group Button */}
      <div className="px-4 pb-2">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="w-full justify-center text-sm bg-(--color-elevated) hover:bg-(--color-border) text-white rounded-full"
          variant="outline"
        >
          <Plus className="mr-2 h-4 w-4" /> Create Group
        </Button>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGroupCreated={(chatId) => {
          setShowCreateModal(false);
          onGroupCreated?.(chatId);
        }}
      />

      {/* Group List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-(--color-text-muted)">
            <Users className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">
              {groupChats.length === 0
                ? "No groups yet"
                : "No groups match your search"}
            </p>
            <p className="text-xs mt-1">
              {groupChats.length === 0 &&
                "Create a group to start chatting with multiple people"}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const lastSender = group.lastMessage
              ? group.participants.find(
                  (p) => p.id === group.lastMessage?.senderId
                )
              : null;

            return (
              <div
                key={group.id}
                onClick={() => onSelectChat(group.id)}
                className={cn(
                  "flex items-center px-4 py-3 cursor-pointer transition-colors duration-150 border-b border-(--color-border)/30",
                  selectedChatId === group.id
                    ? "bg-(--color-elevated)"
                    : "hover:bg-(--color-surface)/50"
                )}
              >
                {/* Group Avatar */}
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-(--color-elevated) flex items-center justify-center border border-(--color-border)">
                    <Users className="h-5 w-5 text-(--color-text-muted)" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-(--color-primary) text-[9px] font-bold text-white flex items-center justify-center">
                    {group.participants.length}
                  </span>
                </div>

                <div className="ml-4 flex-1 overflow-hidden">
                  <div className="flex justify-between items-baseline gap-2">
                    <h3 className="text-sm font-medium truncate">
                      {group.name}
                    </h3>
                    {group.lastMessage && (
                      <span className="text-xs text-(--color-text-muted) shrink-0">
                        {new Date(
                          group.lastMessage.timestamp
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-(--color-text-muted) truncate mt-0.5">
                    {group.participants.length} members
                  </p>
                  <div className="flex justify-between items-center gap-2 mt-0.5">
                    <p className="text-xs text-(--color-text-muted) truncate line-clamp-1">
                      {group.lastMessage
                        ? `${lastSender?.name || "Someone"}: ${group.lastMessage.content}`
                        : "No messages yet"}
                    </p>
                    {group.unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--color-primary) text-[11px] font-bold text-white shrink-0">
                        {group.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
