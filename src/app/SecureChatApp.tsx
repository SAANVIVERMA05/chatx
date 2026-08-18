"use client";

import { useState } from "react";
import { Search, Plus, MessageSquare, Users, Settings, UserCircle, Lock, Phone, MoreVertical, Paperclip, Smile, Mic, Send, FileText, Image as ImageIcon, Expand, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ChatModal from "@/components/ChatModal";
import { mockChats, mockUsers, currentUser, mockMessages } from "@/lib/mockData";
import { cn } from "@/lib/utils";

// Contact info type
interface ContactInfo {
  address: string;
  email: string;
  phone: string;
  lastVisited: string;
}

const contactInfoMap: Record<string, ContactInfo> = {
  "u2": { address: "123 Main St, USA", email: "alene@example.com", phone: "555-0123", lastVisited: "30, Nov 2024" },
  "u3": { address: "32188 Sips Parkways, U.S", email: "Keefe@codedtheme.com", phone: "995-250-1803", lastVisited: "30, Nov 2024" },
  "u4": { address: "456 Oak Ave, USA", email: "wilhelmine@example.com", phone: "555-0456", lastVisited: "25, Nov 2024" },
  "u5": { address: "789 Pine Ln, USA", email: "lazaro@example.com", phone: "555-0789", lastVisited: "22, Nov 2024" },
  "u6": { address: "321 Elm St, USA", email: "herman@example.com", phone: "555-0321", lastVisited: "28, Nov 2024" },
  "u7": { address: "654 Maple Dr, USA", email: "agliulf@example.com", phone: "555-0654", lastVisited: "26, Nov 2024" },
  "u8": { address: "987 Cedar Ln, USA", email: "lazaro2@example.com", phone: "555-0987", lastVisited: "29, Nov 2024" },
  "u9": { address: "159 Birch Rd, USA", email: "stebin@example.com", phone: "555-1592", lastVisited: "30, Nov 2024" },
};

export default function SecureChatApp() {
  const [activeTab, setActiveTab] = useState<"chats" | "contacts" | "groups" | "settings" | "profile">("chats");
  const [selectedChatId, setSelectedChatId] = useState<string | null>("c8");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewingProfileOnly, setIsViewingProfileOnly] = useState(false);

  const selectedChat = mockChats.find((c) => c.id === selectedChatId);
  const activeMessages = selectedChatId ? mockMessages[selectedChatId] || [] : [];
  const chatPartner = selectedChat?.type === "direct" 
    ? selectedChat.participants.find(p => p.id !== currentUser.id) 
    : undefined;
  const partnerInfo = chatPartner ? contactInfoMap[chatPartner.id] : undefined;

  return (
    <>
      <div className="flex h-screen w-full bg-(--color-background) text-(--color-text-primary) overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[320px] flex-shrink-0 border-r border-(--color-border) bg-(--color-sidebar) flex flex-col transition-all duration-300">
        <div className="p-4 flex items-center justify-between border-b border-(--color-border)">
          <div className="flex items-center space-x-2">
            <Lock className="h-6 w-6 text-(--color-primary)" />
            <h1 className="text-xl font-bold tracking-tight">Message</h1>
          </div>
          <Avatar size="sm" status={currentUser.status} fallback="You" />
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-(--color-text-muted)" />
            <Input placeholder="Search messages..." className="pl-9 bg-(--color-surface) border-none rounded-full text-sm" />
          </div>
        </div>

        <div className="px-4 py-2">
          <Button className="w-full justify-center text-sm shadow-sm bg-(--color-primary) hover:bg-(--color-primary)/90 text-white rounded-full" variant="default">
            <Plus className="mr-2 h-4 w-4" /> New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === "chats" && (
            <div className="space-y-0 px-0">
              {mockChats.map((chat) => {
                const partner = chat.type === "direct" ? chat.participants.find(p => p.id !== currentUser.id) : null;
                const name = chat.type === "group" ? chat.name : partner?.name;
                const status = chat.type === "direct" ? partner?.status : undefined;
                const title = chat.type === "direct" ? partner?.title : undefined;

                return (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={cn(
                      "flex items-center px-4 py-3 cursor-pointer transition-colors duration-150 border-b border-(--color-border)/30",
                      selectedChatId === chat.id ? "bg-(--color-elevated)" : "hover:bg-(--color-surface)/50"
                    )}
                  >
                    <Avatar size="md" status={status} fallback={name?.charAt(0)} />
                    <div className="ml-4 flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline gap-2">
                        <h3 className="text-sm font-medium truncate">{name}</h3>
                        {chat.lastMessage && (
                          <span className="text-xs text-(--color-text-muted) shrink-0">
                            {chat.lastMessage.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-(--color-text-muted) truncate mt-1 mb-1">{title}</p>
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-xs text-(--color-text-muted) truncate line-clamp-1">
                          {chat.lastMessage?.content || "No messages"}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--color-primary) text-[11px] font-bold text-white shrink-0">
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

      {/* Main Chat Area or Profile View */}
      {isViewingProfileOnly && selectedChat && chatPartner ? (
        <main className="flex-1 flex flex-col bg-(--color-background) relative overflow-y-auto">
          {/* Profile Header */}
          <header className="h-16 border-b border-(--color-border) flex items-center justify-between px-6 bg-(--color-surface) sticky top-0 z-10">
            <div className="flex items-center flex-1">
              <h1 className="text-xl font-bold tracking-tight">chatx</h1>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => setIsViewingProfileOnly(false)}
              title="Close profile"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          {/* Profile Content */}
          <div className="flex-1 flex flex-col items-center justify-start p-8 space-y-8">
            <div className="flex flex-col items-center">
              <Avatar size="xl" status={chatPartner?.status} fallback={chatPartner?.name?.charAt(0)} className="mb-6 shadow-2xl" />
              <h2 className="text-3xl font-bold mb-2">{chatPartner?.name}</h2>
              <p className="text-lg text-(--color-text-muted)">
                {chatPartner?.status === "online" && "🟢 Available"}
                {chatPartner?.status === "offline" && "🔴 Away"}
                {chatPartner?.status === "busy" && "🟠 Busy"}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex space-x-8">
              <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                <div className="h-12 w-12 bg-(--color-elevated) rounded-full flex items-center justify-center mb-2"><Phone className="h-5 w-5" /></div>
                <span className="text-sm">Audio</span>
              </div>
              <div className="flex flex-col items-center text-(--color-text-muted) hover:text-(--color-primary) cursor-pointer transition-colors">
                <div className="h-12 w-12 bg-(--color-elevated) rounded-full flex items-center justify-center mb-2"><Search className="h-5 w-5" /></div>
                <span className="text-sm">Search</span>
              </div>
            </div>

            {/* Information Section */}
            <div className="w-full max-w-md">
              <h3 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider mb-6">Information</h3>
              <div className="space-y-6">
                <div className="border-l-4 border-(--color-primary) pl-4">
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Address</p>
                  <p className="text-base font-medium">{partnerInfo?.address}</p>
                </div>
                <div className="border-l-4 border-(--color-primary) pl-4">
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Email</p>
                  <p className="text-base font-medium text-(--color-primary) cursor-pointer hover:underline">{partnerInfo?.email}</p>
                </div>
                <div className="border-l-4 border-(--color-primary) pl-4">
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Phone</p>
                  <p className="text-base font-medium">{partnerInfo?.phone}</p>
                </div>
                <div className="border-l-4 border-(--color-primary) pl-4">
                  <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mb-1">Last visited</p>
                  <p className="text-base font-medium">{partnerInfo?.lastVisited}</p>
                </div>
              </div>
            </div>

            {/* Notification Section */}
            <div className="w-full max-w-md border-t border-(--color-border) pt-8">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Notification</h3>
                <button 
                  onClick={() => setNotificationEnabled(!notificationEnabled)}
                  className={cn(
                    "relative inline-flex h-6 w-11 rounded-full transition-colors",
                    notificationEnabled ? "bg-(--color-primary)" : "bg-(--color-border)"
                  )}
                >
                  <span 
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                      notificationEnabled ? "translate-x-6" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* File type Section */}
            <div className="w-full max-w-md border-t border-(--color-border) pt-8">
              <h3 className="text-sm font-semibold mb-4">File type</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-(--color-elevated) rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-(--color-primary)/20 rounded flex items-center justify-center">
                      <FileText className="h-5 w-5 text-(--color-primary)" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Document</p>
                      <p className="text-xs text-(--color-text-muted)">1 KB, 321MiB</p>
                    </div>
                  </div>
                  <MoreVertical className="h-4 w-4 text-(--color-text-muted)" />
                </div>
                <div className="flex items-center justify-between p-4 bg-(--color-elevated) rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-(--color-primary)/20 rounded flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-(--color-primary)" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Photos</p>
                      <p className="text-xs text-(--color-text-muted)">53 File, 321MiB</p>
                    </div>
                  </div>
                  <MoreVertical className="h-4 w-4 text-(--color-text-muted)" />
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col bg-(--color-background) relative">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <header className="h-16 border-b border-(--color-border) flex items-center justify-between px-6 bg-(--color-surface) sticky top-0 z-10">
                <div className="flex items-center flex-1">
                  <Avatar size="md" status={chatPartner?.status} fallback={chatPartner?.name?.charAt(0) || selectedChat.name?.charAt(0)} />
                  <div className="ml-4 flex-1">
                    <h2 className="text-base font-semibold cursor-pointer hover:text-(--color-primary) transition-colors" onClick={() => setIsViewingProfileOnly(true)}>{selectedChat.type === "group" ? selectedChat.name : chatPartner?.name}</h2>
                  <p className="text-xs text-(--color-text-muted) mt-0.5">
                    {chatPartner?.status === "online" && "Active now"}
                    {chatPartner?.status === "offline" && chatPartner?.lastSeen}
                    {chatPartner?.status === "busy" && "Busy"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsModalOpen(true)} title="Expand"><Expand className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9"><Phone className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9"><Search className="h-5 w-5" /></Button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar flex flex-col bg-(--color-background)">
              {activeMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-(--color-text-muted)">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isMine = msg.senderId === currentUser.id;
                  const sender = mockUsers[msg.senderId];
                  return (
                    <div key={msg.id} className={cn("flex max-w-[75%]", isMine ? "self-end" : "self-start")}>
                      {!isMine && selectedChat.type === "group" && (
                        <Avatar size="sm" className="mr-3 self-end mb-1" fallback={sender?.name?.charAt(0)} />
                      )}
                      <div className="flex flex-col">
                        {!isMine && selectedChat.type === "group" && (
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
        )}
      

      </div>

      {/* Chat Modal */}
      <ChatModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        chat={selectedChat}
        messages={activeMessages}
        chatPartner={chatPartner}
      />
    </>
  );
}
