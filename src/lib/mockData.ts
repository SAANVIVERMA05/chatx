export type User = {
  id: string;
  name: string;
  avatar?: string;
  status: "online" | "offline" | "busy";
  lastSeen?: string;
  isVerified?: boolean;
  title?: string;
  department?: string;
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
    name: "Alene",
    status: "online",
    isVerified: true,
    title: "Technical Department",
  },
  "u3": {
    id: "u3",
    name: "John Doe",
    status: "online",
    isVerified: true,
    title: "Team Worker",
  },
  "u4": {
    id: "u4",
    name: "Wilhelmine Durng",
    status: "offline",
    lastSeen: "2 hours ago",
    isVerified: false,
    title: "Technical Department",
  },
  "u5": {
    id: "u5",
    name: "Lazaro Group",
    status: "offline",
    lastSeen: "1 day ago",
    title: "Technical Department",
  },
  "u6": {
    id: "u6",
    name: "Herman Essertg",
    status: "busy",
    title: "Technical Department",
  },
  "u7": {
    id: "u7",
    name: "Agliulf Fugg",
    status: "offline",
    lastSeen: "2 hours ago",
    title: "Typing",
  },
  "u8": {
    id: "u8",
    name: "Lazaro",
    status: "online",
    title: "Technical Department",
  },
  "u9": {
    id: "u9",
    name: "Stebin Ben",
    status: "online",
    isVerified: true,
    title: "UI/UX Designer",
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
      content: "Let's schedule a meeting",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c2",
    type: "direct",
    participants: [currentUser, mockUsers["u3"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m2",
      chatId: "c2",
      senderId: "u3",
      content: "Sounds good!",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c3",
    type: "direct",
    participants: [currentUser, mockUsers["u4"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m3",
      chatId: "c3",
      senderId: "u4",
      content: "Talk later",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c4",
    type: "direct",
    participants: [currentUser, mockUsers["u5"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m4",
      chatId: "c4",
      senderId: "u5",
      content: "Great!",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c5",
    type: "direct",
    participants: [currentUser, mockUsers["u6"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m5",
      chatId: "c5",
      senderId: "u6",
      content: "See you then",
      timestamp: "30 min ago",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c6",
    type: "direct",
    participants: [currentUser, mockUsers["u7"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m6",
      chatId: "c6",
      senderId: "u7",
      content: "Thanks!",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c7",
    type: "direct",
    participants: [currentUser, mockUsers["u8"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m7",
      chatId: "c7",
      senderId: "u8",
      content: "Perfect",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    }
  },
  {
    id: "c8",
    type: "direct",
    participants: [currentUser, mockUsers["u9"]],
    unreadCount: 0,
    isEncrypted: true,
    lastMessage: {
      id: "m8",
      chatId: "c8",
      senderId: "u9",
      content: "How can I help you today?",
      timestamp: "9h ago",
      status: "read",
      type: "text",
    }
  }
];

export const mockMessages: Record<string, Message[]> = {
  "c1": [
    {
      id: "m1",
      chatId: "c1",
      senderId: "u2",
      content: "Hey, nice to meet you!",
      timestamp: "9h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m2",
      chatId: "c1",
      senderId: "u1",
      content: "Hi Alene! Great to connect with you.",
      timestamp: "8h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m3",
      chatId: "c1",
      senderId: "u2",
      content: "Let's schedule a meeting to discuss the project",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    },
  ],
  "c2": [
    {
      id: "m4",
      chatId: "c2",
      senderId: "u3",
      content: "Good morning! How are you doing?",
      timestamp: "10h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m5",
      chatId: "c2",
      senderId: "u1",
      content: "Morning John! All good, thanks for asking.",
      timestamp: "9h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m6",
      chatId: "c2",
      senderId: "u3",
      content: "Sounds good!",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    },
  ],
  "c3": [
    {
      id: "m7",
      chatId: "c3",
      senderId: "u4",
      content: "Hi there!",
      timestamp: "11h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m8",
      chatId: "c3",
      senderId: "u1",
      content: "Hey Wilhelmine! What's up?",
      timestamp: "10h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m9",
      chatId: "c3",
      senderId: "u4",
      content: "Talk later",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    },
  ],
  "c4": [
    {
      id: "m10",
      chatId: "c4",
      senderId: "u5",
      content: "Update on the project status?",
      timestamp: "12h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m11",
      chatId: "c4",
      senderId: "u1",
      content: "Yes, everything is on track. I'll send a detailed report soon.",
      timestamp: "11h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m12",
      chatId: "c4",
      senderId: "u5",
      content: "Great!",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    },
  ],
  "c5": [
    {
      id: "m13",
      chatId: "c5",
      senderId: "u6",
      content: "Don't forget about the team meeting tomorrow",
      timestamp: "8h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m14",
      chatId: "c5",
      senderId: "u1",
      content: "Got it! I'll be there.",
      timestamp: "7h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m15",
      chatId: "c5",
      senderId: "u6",
      content: "See you then",
      timestamp: "30 min ago",
      status: "read",
      type: "text",
    },
  ],
  "c6": [
    {
      id: "m16",
      chatId: "c6",
      senderId: "u7",
      content: "Can you review the document?",
      timestamp: "5h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m17",
      chatId: "c6",
      senderId: "u1",
      content: "Sure, I'll check it out.",
      timestamp: "4h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m18",
      chatId: "c6",
      senderId: "u7",
      content: "Thanks!",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    },
  ],
  "c7": [
    {
      id: "m19",
      chatId: "c7",
      senderId: "u8",
      content: "Are you available for a quick call?",
      timestamp: "6h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m20",
      chatId: "c7",
      senderId: "u1",
      content: "Yes, give me 10 minutes.",
      timestamp: "5h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m21",
      chatId: "c7",
      senderId: "u8",
      content: "Perfect",
      timestamp: "2h ago",
      status: "read",
      type: "text",
    },
  ],
  "c8": [
    {
      id: "m22",
      chatId: "c8",
      senderId: "u9",
      content: "Hey, Henry!",
      timestamp: "9h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m23",
      chatId: "c8",
      senderId: "u1",
      content: "How can I help you today?",
      timestamp: "9h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m24",
      chatId: "c8",
      senderId: "u9",
      content: "I'm good thank you for asking.",
      timestamp: "8h ago",
      status: "read",
      type: "text",
    },
    {
      id: "m25",
      chatId: "c8",
      senderId: "u1",
      content: "How can I cap you today?",
      timestamp: "8h ago",
      status: "read",
      type: "text",
    }
  ]
};
