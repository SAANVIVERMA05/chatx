/**
 * In-memory store for Next.js API routes.
 * Uses globalThis to persist data across HMR in development.
 */

interface User {
  id: string;
  username: string;
  phone_number: string;
  avatar_url: string | null;
  created_at: string;
  firebase_uid?: string;
}

interface OtpRecord {
  phone_number: string;
  code: string; // local fallback (console mode)
  request_id?: string; // Vonage Verify API request ID
  user_id: string;
  expires_at: number;
  used: boolean;
}

interface Chat {
  id: string;
  type: "direct" | "group";
  name: string | null;
  participants: User[];
  lastMessage: any | null;
  unreadCount: number;
  isEncrypted: boolean;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  status: string;
  type: string;
  file?: { name: string; size: string; url?: string };
  sender?: { id: string; name: string; avatar?: string; status: string };
  replyTo?: { id: string; content: string; senderName: string };
}

// ── globalThis-backed state (survives HMR) ──────────────────
function uid() {
  return crypto.randomUUID();
}

interface StoreState {
  USERS: User[];
  OTPS: OtpRecord[];
  MESSAGES: Message[];
  CHATS: Chat[];
  TOKENS: Map<string, string>;
}

declare global {
  var __chatx_store: StoreState | undefined;
}

function getState(): StoreState {
  if (globalThis.__chatx_store) {
    return globalThis.__chatx_store;
  }

  // Initialize seed data
  const now = new Date().toISOString();

  const USERS: User[] = [
    { id: "u1", username: "alice", phone_number: "+1234567890", avatar_url: null, created_at: now, firebase_uid: "fb_alice" },
    { id: "u2", username: "bob", phone_number: "+1234567891", avatar_url: null, created_at: now, firebase_uid: "fb_bob" },
    { id: "u3", username: "charlie", phone_number: "+1234567892", avatar_url: null, created_at: now, firebase_uid: "fb_charlie" },
    { id: "u4", username: "diana", phone_number: "+1234567893", avatar_url: null, created_at: now, firebase_uid: "fb_diana" },
    { id: "u5", username: "edward", phone_number: "+1234567894", avatar_url: null, created_at: now, firebase_uid: "fb_edward" },
    { id: "u6", username: "fiona", phone_number: "+1234567895", avatar_url: null, created_at: now, firebase_uid: "fb_fiona" },
  ];

  const OTPS: OtpRecord[] = [];
  const MESSAGES: Message[] = [];
  const TOKENS = new Map<string, string>();

  const CHATS: Chat[] = [
    {
      id: "c1", type: "direct", name: null, isEncrypted: true, unreadCount: 0,
      participants: [USERS[0], USERS[1]],
      lastMessage: null,
    },
    {
      id: "c2", type: "direct", name: null, isEncrypted: true, unreadCount: 0,
      participants: [USERS[0], USERS[2]],
      lastMessage: null,
    },
    {
      id: "c3", type: "direct", name: null, isEncrypted: true, unreadCount: 0,
      participants: [USERS[0], USERS[3]],
      lastMessage: null,
    },
    {
      id: "c4", type: "group", name: "Team Chat", isEncrypted: true, unreadCount: 0,
      participants: [USERS[0], USERS[1], USERS[2], USERS[3]],
      lastMessage: null,
    },
    {
      id: "c5", type: "group", name: "Design Review", isEncrypted: true, unreadCount: 0,
      participants: [USERS[0], USERS[4], USERS[5]],
      lastMessage: null,
    },
  ];

  // Seed messages
  const seedMsgs = [
    { chatId: "c1", senderId: "u1", content: "Hey Bob, how's the project going?" },
    { chatId: "c1", senderId: "u2", content: "Going well! Just finished the API endpoints." },
    { chatId: "c1", senderId: "u1", content: "Nice. Can you review my PR?" },
    { chatId: "c2", senderId: "u3", content: "Alice, did you see the new design specs?" },
    { chatId: "c2", senderId: "u1", content: "Yes! They look great." },
    { chatId: "c4", senderId: "u1", content: "Welcome to Team Chat, everyone! 🎉" },
    { chatId: "c4", senderId: "u2", content: "Glad to be here!" },
    { chatId: "c4", senderId: "u4", content: "Let's ship great things together!" },
  ];

  for (const m of seedMsgs) {
    const msg: Message = {
      id: uid(), chatId: m.chatId, senderId: m.senderId,
      content: m.content, timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      status: "delivered", type: "text",
      sender: USERS.find((u) => u.id === m.senderId)
        ? { id: m.senderId, name: USERS.find((u) => u.id === m.senderId)!.username, status: "online" }
        : undefined,
    };
    MESSAGES.push(msg);
    const chat = CHATS.find((c) => c.id === m.chatId);
    if (chat) chat.lastMessage = msg;
  }

  globalThis.__chatx_store = { USERS, OTPS, MESSAGES, CHATS, TOKENS };
  return globalThis.__chatx_store;
}

// ── Exports ─────────────────────────────────────────────────
export const store = {
  get USERS() { return getState().USERS; },
  get OTPS() { return getState().OTPS; },
  get MESSAGES() { return getState().MESSAGES; },
  get CHATS() { return getState().CHATS; },

  generateToken(userId: string): string {
    const state = getState();
    const token = `tok_${uid()}`;
    state.TOKENS.set(token, userId);
    return token;
  },

  getUserIdFromToken(token: string): string | null {
    return getState().TOKENS.get(token) || null;
  },

  findUserByPhone(phone: string): User | undefined {
    return getState().USERS.find((u) => u.phone_number === phone);
  },

  createUser(phone: string): User {
    const state = getState();
    const user: User = {
      id: uid(),
      username: `user_${phone.slice(-4)}_${Date.now()}`,
      phone_number: phone,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };
    state.USERS.push(user);
    return user;
  },

  updateUser(id: string, data: Partial<User>): User | undefined {
    const user = getState().USERS.find((u) => u.id === id);
    if (user) Object.assign(user, data);
    return user;
  },

  createOtp(phone: string, code: string, userId: string, requestId?: string): void {
    const state = getState();
    // Invalidate old OTPs
    for (const otp of state.OTPS) {
      if (otp.phone_number === phone && !otp.used) otp.used = true;
    }
    state.OTPS.push({
      phone_number: phone,
      code,
      request_id: requestId,
      user_id: userId,
      expires_at: Date.now() + 10 * 60 * 1000,
      used: false,
    });
  },

  getActiveOtp(phone: string): OtpRecord | undefined {
    const state = getState();
    return state.OTPS.find(
      (o) => o.phone_number === phone && !o.used && o.expires_at > Date.now()
    );
  },

  verifyOtp(phone: string, code: string): OtpRecord | null {
    const state = getState();
    const otp = state.OTPS.find(
      (o) => o.phone_number === phone && o.code === code && !o.used && o.expires_at > Date.now()
    );
    if (otp) {
      otp.used = true;
      return otp;
    }
    return null;
  },

  getChatsForUser(userId: string): Chat[] {
    return getState().CHATS.filter((c) => c.participants.some((p) => p.id === userId));
  },

  getMessagesForChat(chatId: string): Message[] {
    return getState().MESSAGES.filter((m) => m.chatId === chatId).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },

  addMessage(chatId: string, senderId: string, content: string, extra?: Partial<Message>): Message {
    const state = getState();
    const sender = state.USERS.find((u) => u.id === senderId);
    const msg: Message = {
      id: uid(), chatId, senderId, content,
      timestamp: new Date().toISOString(),
      status: "delivered",
      type: extra?.type || "text",
      file: extra?.file,
      sender: sender ? { id: sender.id, name: sender.username, status: "online" } : undefined,
      replyTo: extra?.replyTo,
    };
    state.MESSAGES.push(msg);
    const chat = state.CHATS.find((c) => c.id === chatId);
    if (chat) chat.lastMessage = msg;
    return msg;
  },

  getAllUsers(): User[] {
    return getState().USERS;
  },

  findUserByPhonePartial(query: string): User[] {
    const q = query.replace(/\s/g, "").toLowerCase();
    return getState().USERS.filter((u) => u.phone_number.replace(/\s/g, "").toLowerCase().includes(q));
  },

  createGroupChat(name: string, creatorId: string, memberIds: string[]): Chat | null {
    const state = getState();
    const creator = state.USERS.find((u) => u.id === creatorId);
    if (!creator) return null;

    const members = memberIds
      .map((id) => state.USERS.find((u) => u.id === id))
      .filter(Boolean) as User[];

    // Always include the creator
    if (!members.some((m) => m.id === creatorId)) {
      members.unshift(creator);
    }

    const chat: Chat = {
      id: uid(),
      type: "group",
      name,
      isEncrypted: true,
      unreadCount: 0,
      participants: members,
      lastMessage: null,
    };
    state.CHATS.push(chat);
    return chat;
  },

  findOrCreateByFirebaseUid(firebaseUid: string, phoneNumber: string): User {
    const state = getState();
    // Find existing user by firebase_uid or phone
    let user = state.USERS.find((u) => u.firebase_uid === firebaseUid || u.phone_number === phoneNumber);
    if (user) {
      // Update firebase_uid if missing
      if (!user.firebase_uid) user.firebase_uid = firebaseUid;
      return user;
    }
    // Create new user
    user = {
      id: uid(),
      username: `user_${phoneNumber.slice(-4)}`,
      phone_number: phoneNumber,
      avatar_url: null,
      created_at: new Date().toISOString(),
      firebase_uid: firebaseUid,
    };
    state.USERS.push(user);
    return user;
  },

  createDirectChat(userId1: string, userId2: string): Chat | null {
    const state = getState();
    const user1 = state.USERS.find((u) => u.id === userId1);
    const user2 = state.USERS.find((u) => u.id === userId2);
    if (!user1 || !user2) return null;

    // Check if a direct chat already exists
    const existing = state.CHATS.find(
      (c) =>
        c.type === "direct" &&
        c.participants.some((p) => p.id === userId1) &&
        c.participants.some((p) => p.id === userId2)
    );
    if (existing) return existing;

    const chat: Chat = {
      id: uid(),
      type: "direct",
      name: null,
      isEncrypted: true,
      unreadCount: 0,
      participants: [user1, user2],
      lastMessage: null,
    };
    state.CHATS.push(chat);
    return chat;
  },
};
