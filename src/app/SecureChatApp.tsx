"use client";

import { useState } from "react";
import { Search, Plus, MessageSquare, Users, Settings, UserCircle, Lock, Phone, MoreVertical, Paperclip, Smile, Mic, Send } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mockChats, mockUsers, currentUser, mockMessages } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export default function SecureChatApp() {
  const [activeTab, setActiveTab] = useState<"chats" | "contacts" | "groups" | "settings" | "profile">("chats");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const selectedChat = mockChats.find((c) => c.id === selectedChatId);
  const activeMessages = selectedChatId ? mockMessages[selectedChatId] || [] : [];
  const chatPartner = selectedChat?.type === "direct" 
    ? selectedChat.participants.find(p => p.id !== currentUser.id) 
    : undefined;

  return (
    <div className="flex h-screen w-full bg-(--color-background) text-(--color-text-primary) overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[320px] flex-shrink-0 border-r border-(--color-border) bg-(--color-sidebar) flex flex-col transition-all duration-300">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="h-6 w-6 text-(--color-primary)" />
            <h1 className="text-xl font-semibold tracking-tight">SecureChat</h1>
          </div>
          <Avatar size="sm" status={currentUser.status} fallback="You" />
        </div>

        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted)" />
            <Input placeholder="Search" className="pl-9 bg-(--color-surface) border-none" />
          </div>
        </div>

        <div className="px-4 py-2">
          <Button className="w-full justify-start text-sm shadow-sm" variant="default">
            <Plus className="mr-2 h-4 w-4" /> New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar mt-2">
          <div className="px-3 text-xs font-semibold text-(--color-text-muted) mb-2 uppercase tracking-wider">
            {activeTab.toUpperCase()}
          </div>
          
          {activeTab === "chats" && (
            <div className="space-y-1 px-2">
              {mockChats.map((chat) => {
                const partner = chat.type === "direct" ? chat.participants.find(p => p.id !== currentUser.id) : null;
                const name = chat.type === "group" ? chat.name : partner?.name;
                const status = chat.type === "direct" ? partner?.status : undefined;

                return (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={cn(
                      "flex items-center p-2 rounded-lg cursor-pointer transition-colors duration-200",
                      selectedChatId === chat.id ? "bg-(--color-elevated)" : "hover:bg-(--color-surface)"
                    )}
                  >
                    <Avatar size="md" status={status} fallback={name?.charAt(0)} />
                    <div className="ml-3 flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline">
                        <h3 className="text-sm font-medium truncate">{name}</h3>
                        {chat.lastMessage && (
                          <span className="text-xs text-(--color-text-muted) ml-2 shrink-0">
                            {chat.lastMessage.timestamp}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-(--color-text-muted) truncate mt-0.5">
                          {chat.lastMessage?.content || "No messages"}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="ml-2 flex h-4 w-4 items-center justify-center rounded-full bg-(--color-primary) text-[10px] font-bold text-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* We'd render Contacts, Groups, Settings, Profile similarly based on activeTab */}
        </div>

        {/* Bottom Nav */}
        <div className="p-3 border-t border-(--color-border) bg-(--color-sidebar) flex justify-between items-center px-6">
          <button onClick={() => setActiveTab("chats")} className={cn("p-2 rounded-md hover:bg-(--color-elevated) transition-colors", activeTab === "chats" ? "text-(--color-primary)" : "text-(--color-text-muted)")}><MessageSquare className="h-5 w-5" /></button>
          <button onClick={() => setActiveTab("contacts")} className={cn("p-2 rounded-md hover:bg-(--color-elevated) transition-colors", activeTab === "contacts" ? "text-(--color-primary)" : "text-(--color-text-muted)")}><Users className="h-5 w-5" /></button>
          <button onClick={() => setActiveTab("profile")} className={cn("p-2 rounded-md hover:bg-(--color-elevated) transition-colors", activeTab === "profile" ? "text-(--color-primary)" : "text-(--color-text-muted)")}><UserCircle className="h-5 w-5" /></button>
          <button onClick={() => setActiveTab("settings")} className={cn("p-2 rounded-md hover:bg-(--color-elevated) transition-colors", activeTab === "settings" ? "text-(--color-primary)" : "text-(--color-text-muted)")}><Settings className="h-5 w-5" /></button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-(--color-background) relative">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <header className="h-16 border-b border-(--color-border) flex items-center justify-between px-6 bg-(--color-surface)/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center">
                <Avatar size="md" status={chatPartner?.status} fallback={chatPartner?.name?.charAt(0) || selectedChat.name?.charAt(0)} />
                <div className="ml-3">
                  <h2 className="text-sm font-semibold">{selectedChat.type === "group" ? selectedChat.name : chatPartner?.name}</h2>
                  <div className="flex items-center text-xs text-(--color-primary) space-x-2 mt-0.5">
                    {chatPartner?.status === "online" && <span>Online</span>}
                    {selectedChat.isEncrypted && (
                      <span className="flex items-center text-(--color-text-muted) cursor-pointer hover:text-(--color-primary) transition-colors">
                        <Lock className="h-3 w-3 mr-1" /> End-to-End Encrypted
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon"><Search className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col">
              {activeMessages.map((msg) => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div key={msg.id} className={cn("flex max-w-[75%]", isMine ? "self-end" : "self-start")}>
                    {!isMine && selectedChat.type === "group" && (
                      <Avatar size="sm" className="mr-2 self-end mb-1" fallback={mockUsers[msg.senderId]?.name.charAt(0)} />
                    )}
                    <div className="flex flex-col">
                      <div
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm relative group",
                          isMine 
                            ? "bg-(--color-primary) text-white rounded-br-sm" 
                            : "bg-(--color-elevated) text-(--color-text-primary) rounded-bl-sm border border-(--color-border)/50"
                        )}
                      >
                        {msg.type === "text" ? (
                          <p className="leading-relaxed">{msg.content}</p>
                        ) : (
                          <div className="flex items-center space-x-3 bg-black/20 p-2 rounded-lg">
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
                      <span className={cn("text-[11px] text-(--color-text-muted) mt-1", isMine ? "text-right" : "text-left")}>
                        {msg.timestamp}
                        {isMine && msg.status === "read" && " ✓✓"}
                        {isMine && msg.status === "delivered" && " ✓"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Composer */}
            <div className="p-4 bg-(--color-surface) border-t border-(--color-border)">
              <div className="flex items-center space-x-2 bg-(--color-elevated) rounded-full px-2 py-1 border border-(--color-border)/50 focus-within:border-(--color-primary)/50 focus-within:ring-1 focus-within:ring-(--color-primary)/20 transition-all">
                <Button variant="ghost" size="icon" className="text-(--color-text-muted) hover:text-white rounded-full"><Paperclip className="h-5 w-5" /></Button>
                <Input 
                  placeholder="Type a secure message..." 
                  className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 px-2 h-10 text-sm" 
                />
                <Button variant="ghost" size="icon" className="text-(--color-text-muted) hover:text-white rounded-full"><Smile className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="text-(--color-text-muted) hover:text-white rounded-full"><Mic className="h-5 w-5" /></Button>
                <Button size="icon" className="rounded-full bg-(--color-primary) text-white h-9 w-9 shrink-0 shadow-md ml-1 hover:bg-(--color-primary-hover) hover:scale-105 transition-all"><Send className="h-4 w-4 ml-0.5" /></Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-(--color-surface) to-(--color-background)">
            <div className="h-24 w-24 bg-(--color-elevated) rounded-full flex items-center justify-center mb-6 shadow-2xl border border-(--color-border)">
              <Lock className="h-10 w-10 text-(--color-primary)" />
            </div>
            <h2 className="text-2xl font-bold mb-2">SecureChat</h2>
            <p className="text-(--color-text-muted) max-w-sm mb-8">
              Select a conversation to start a private messaging session.
            </p>
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-(--color-elevated) border border-(--color-border) text-sm font-medium text-(--color-text-muted)">
              <Lock className="h-4 w-4 mr-2" /> End-to-End Encrypted
            </div>
          </div>
        )}
      </main>
      
      {/* Contact Details Right Panel (visible on desktop) */}
      {selectedChat && (
        <aside className="hidden lg:flex w-[320px] flex-shrink-0 border-l border-(--color-border) bg-(--color-surface)/30 flex-col overflow-y-auto custom-scrollbar">
          <div className="p-6 flex flex-col items-center border-b border-(--color-border)">
            <Avatar size="xl" status={chatPartner?.status} fallback={chatPartner?.name?.charAt(0) || selectedChat.name?.charAt(0)} className="mb-4 shadow-xl" />
            <h2 className="text-lg font-semibold">{selectedChat.type === "group" ? selectedChat.name : chatPartner?.name}</h2>
            <p className="text-sm text-(--color-text-muted) mb-4">
              {chatPartner?.status === "online" ? "🟢 Online" : chatPartner?.lastSeen}
            </p>
            
            {/* Quick Actions */}
            <div className="flex space-x-6 w-full justify-center mt-2">
              <div className="flex flex-col items-center text-(--color-text-muted) hover:text-white cursor-pointer transition-colors">
                <div className="h-10 w-10 bg-(--color-elevated) rounded-full flex items-center justify-center mb-1"><Phone className="h-4 w-4" /></div>
                <span className="text-xs">Audio</span>
              </div>
              <div className="flex flex-col items-center text-(--color-text-muted) hover:text-white cursor-pointer transition-colors">
                <div className="h-10 w-10 bg-(--color-elevated) rounded-full flex items-center justify-center mb-1"><Search className="h-4 w-4" /></div>
                <span className="text-xs">Search</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">Security</h3>
              <div className="flex items-center justify-between p-3 bg-(--color-elevated) rounded-lg border border-(--color-primary)/20 cursor-pointer hover:bg-(--color-primary)/10 transition-colors">
                <div className="flex items-center">
                  <Lock className="h-5 w-5 text-(--color-primary) mr-3" />
                  <div>
                    <p className="text-sm font-medium text-(--color-primary)">Verify Contact</p>
                    <p className="text-xs text-(--color-text-muted)">Secure session active</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">Media, Links, and Docs</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="aspect-square bg-(--color-elevated) rounded-md"></div>
                <div className="aspect-square bg-(--color-elevated) rounded-md"></div>
                <div className="aspect-square bg-(--color-elevated) rounded-md flex items-center justify-center text-xs text-(--color-text-muted) cursor-pointer hover:bg-(--color-border)">+12</div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
