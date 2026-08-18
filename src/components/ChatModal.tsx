"use client";

import { X, Search, Phone, MoreVertical, Paperclip, Smile, Send } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Message, User, Chat } from "@/lib/mockData";
import { mockUsers } from "@/lib/mockData";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  messages: Message[];
  chatPartner: User | undefined;
}

export default function ChatModal({ isOpen, onClose, chat, messages, chatPartner }: ChatModalProps) {
  if (!isOpen || !chat || !chatPartner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full h-full max-w-5xl max-h-[90vh] bg-(--color-background) rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-16 border-b border-(--color-border) flex items-center justify-between px-6 bg-(--color-surface)">
            <div className="flex items-center flex-1">
              <Avatar size="md" status={chatPartner?.status} fallback={chatPartner?.name?.charAt(0)} />
              <div className="ml-4 flex-1">
                <h2 className="text-base font-semibold">{chatPartner?.name}</h2>
                <p className="text-xs text-(--color-text-muted) mt-0.5">
                  {chatPartner?.status === "online" && "Active now"}
                  {chatPartner?.status === "offline" && chatPartner?.lastSeen}
                  {chatPartner?.status === "busy" && "Busy"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" className="h-9 w-9"><Phone className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9"><Search className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9"><MoreVertical className="h-5 w-5" /></Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 ml-4"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar flex flex-col bg-(--color-background)">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-(--color-text-muted)">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === "u1";
                const sender = mockUsers[msg.senderId];
                return (
                  <div key={msg.id} className={cn("flex max-w-[75%]", isMine ? "self-end" : "self-start")}>
                    {!isMine && chat.type === "group" && (
                      <Avatar size="sm" className="mr-3 self-end mb-1" fallback={sender?.name?.charAt(0)} />
                    )}
                    <div className="flex flex-col">
                      {!isMine && chat.type === "group" && (
                        <p className="text-xs text-(--color-text-muted) mb-1 ml-0.5">{sender?.name}</p>
                      )}
                      <div
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm",
                          isMine 
                            ? "bg-(--color-primary) text-white rounded-br-none" 
                            : "bg-(--color-elevated) text-(--color-text-primary) rounded-bl-none border border-(--color-border)"
                        )}
                      >
                        {msg.type === "text" ? (
                          <p className="leading-relaxed">{msg.content}</p>
                        ) : (
                          <div className="flex items-center space-x-3 bg-black/20 p-3 rounded-lg">
                            <div className="h-10 w-10 bg-white/10 rounded flex items-center justify-center">
                              <Paperclip className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{msg.file?.name}</p>
                              <p className="text-xs opacity-70">{msg.file?.size}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className={cn("text-[11px] text-(--color-text-muted) mt-1 px-1", isMine ? "text-right" : "text-left")}>
                        {msg.timestamp}
                        {isMine && msg.status === "read" && " ✓✓"}
                        {isMine && msg.status === "delivered" && " ✓"}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Composer */}
          <div className="px-4 py-3 bg-(--color-surface) border-t border-(--color-border)">
            <div className="flex items-center space-x-2 bg-(--color-background) rounded-full px-3 py-2 border border-(--color-border) focus-within:border-(--color-primary) focus-within:ring-1 focus-within:ring-(--color-primary)/20 transition-all">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-(--color-text-muted) hover:text-(--color-primary) transition-colors"><Paperclip className="h-5 w-5" /></Button>
              <Input 
                placeholder="Type a message..." 
                className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 px-1 text-sm placeholder:text-(--color-text-muted)" 
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-(--color-text-muted) hover:text-(--color-primary) transition-colors"><Smile className="h-5 w-5" /></Button>
              <Button size="icon" className="h-8 w-8 rounded-full bg-(--color-primary) text-white hover:bg-(--color-primary)/90 transition-all" title="Send message"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {/* Right Panel - Contact Info */}
        <div className="w-80 border-l border-(--color-border) bg-(--color-sidebar) flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-6 flex flex-col items-center border-b border-(--color-border)">
            <Avatar size="xl" status={chatPartner?.status} fallback={chatPartner?.name?.charAt(0)} className="mb-4 shadow-xl" />
            <h2 className="text-lg font-semibold">{chatPartner?.name}</h2>
            <p className="text-sm text-(--color-text-muted) mb-4">
              {chatPartner?.status === "online" && "🟢 Available"}
              {chatPartner?.status === "offline" && "🔴 Away"}
              {chatPartner?.status === "busy" && "🟠 Busy"}
            </p>
            
            {/* Quick Actions */}
            <div className="flex space-x-6 w-full justify-center mt-4">
              <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                <div className="h-10 w-10 bg-(--color-elevated) rounded-full flex items-center justify-center mb-1"><Phone className="h-4 w-4" /></div>
                <span className="text-xs">Audio</span>
              </div>
              <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                <div className="h-10 w-10 bg-(--color-elevated) rounded-full flex items-center justify-center mb-1"><Search className="h-4 w-4" /></div>
                <span className="text-xs">Search</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Information Section */}
            <div>
              <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-4">Information</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Address</p>
                  <p>32188 Sips Parkways, U.S</p>
                </div>
                <div>
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Email</p>
                  <p className="text-(--color-primary) cursor-pointer hover:underline">Keefe@codedtheme.com</p>
                </div>
                <div>
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Phone</p>
                  <p>995-250-1803</p>
                </div>
                <div>
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Last visited</p>
                  <p>30, Nov 2024</p>
                </div>
              </div>
            </div>

            {/* Notification Section */}
            <div className="border-t border-(--color-border) pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Notification</h3>
                <button className="relative inline-flex h-6 w-11 rounded-full bg-(--color-primary) transition-colors">
                  <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform translate-x-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
