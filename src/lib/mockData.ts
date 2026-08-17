export type User = {
  id: string;
  name: string;
  avatar?: string;
  status: "online" | "offline" | "busy";
  lastSeen?: string;
  isVerified?: boolean;
};

export type Message = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  type: "text" | "file";
  file?: {
    name: string;
    size: string;
    progress?: number;
  };
};

export type Chat = {
  id: string;
  type: "direct" | "group";
  participants: User[];
  name?: string; // For groups
  avatar?: string; // For groups
  lastMessage?: Message;
  unreadCount: number;
  isEncrypted: boolean;
};

// Mock Users
export const currentUser: User = {
  id: "u1",
  name: "You",
  status: "online",
};

export const mockUsers: Record<string, User> = {
  "u2": {
    id: "u2",
    name: "Alice Johnson",
    status: "online",
    isVerified: true,
  },
  "u3": {
    id: "u3",
    name: "Rahul Sharma",
    status: "online",
    isVerified: true,
  },
  "u4": {
    id: "u4",
    name: "Priya Singh",
    status: "offline",
    lastSeen: "2 hours ago",
    isVerified: false,
  },
  "u5": {
    id: "u5",
    name: "Bob Williams",
    status: "offline",
    lastSeen: "1 day ago",
  },
  "u6": {
    id: "u6",
    name: "Ananya Singh",
    status: "busy",
  }
};

// Mock Chats
export const mockChats: Chat[] = [
  {
    id: "c1",
    type: "direct",
    participants: [currentUser, mockUsers["u2"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m1",
      chatId: "c1",
      senderId: "u2",
      content: "Are you joining the meeting?",
      timestamp: "10:30 AM",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c2",
    type: "direct",
    participants: [currentUser, mockUsers["u3"]],
    unreadCount: 2,
    isEncrypted: true,
    lastMessage: {
      id: "m2",
      chatId: "c2",
      senderId: "u3",
      content: "See you tomorrow.",
      timestamp: "10:15 AM",
      status: "delivered",
      type: "text",
    }
  },
  {
    id: "c3",
    type: "group",
    name: "Development Team",
    participants: [currentUser, mockUsers["u2"], mockUsers["u3"], mockUsers["u4"]],
    unreadCount: 5,
    isEncrypted: true,
    lastMessage: {
      id: "m3",
      chatId: "c3",
      senderId: "u4",
      content: "New build is ready",
      timestamp: "09:00 AM",
      status: "delivered",
      type: "text",
    }
  },
  {
    id: "c4",
    type: "group",
    name: "Product Team",
    participants: [currentUser, mockUsers["u2"], mockUsers["u5"], mockUsers["u6"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m4",
      chatId: "c4",
      senderId: "u5",
      content: "Let's review this.",
      timestamp: "Yesterday",
      status: "read",
      type: "text",
    }
  }
];

export const mockMessages: Record<string, Message[]> = {
  "c2": [
    {
      id: "m10",
      chatId: "c2",
      senderId: "u3",
      content: "Hey! How are you?",
      timestamp: "10:32 AM",
      status: "read",
      type: "text",
    },
    {
      id: "m11",
      chatId: "c2",
      senderId: "u1",
      content: "I'm doing great! 👋",
      timestamp: "10:33 AM",
      status: "read",
      type: "text",
    },
    {
      id: "m12",
      chatId: "c2",
      senderId: "u1",
      content: "",
      timestamp: "10:34 AM",
      status: "read",
      type: "file",
      file: {
        name: "project-report.pdf",
        size: "2.4 MB"
      }
    },
    {
      id: "m2",
      chatId: "c2",
      senderId: "u3",
      content: "See you tomorrow.",
      timestamp: "10:35 AM",
      status: "delivered",
      type: "text",
    }
  ]
};
