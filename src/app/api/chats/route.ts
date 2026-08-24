import { NextResponse } from "next/server";
import { store } from "../store";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const userId = store.getUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userChats = store.getChatsForUser(userId);

    // Map to frontend format
    const chats = userChats.map((chat) => ({
      id: chat.id,
      type: chat.type,
      name: chat.name,
      isEncrypted: chat.isEncrypted,
      unreadCount: chat.unreadCount,
      participants: chat.participants.map((p) => ({
        id: p.id,
        name: p.username,
        avatar: p.avatar_url,
        status: "online",
      })),
      lastMessage: chat.lastMessage
        ? {
            id: chat.lastMessage.id,
            chatId: chat.lastMessage.chatId,
            senderId: chat.lastMessage.senderId,
            content: chat.lastMessage.content,
            timestamp: chat.lastMessage.timestamp,
            status: chat.lastMessage.status,
            type: chat.lastMessage.type,
            file: chat.lastMessage.file,
            sender: chat.lastMessage.sender,
          }
        : null,
    }));

    return NextResponse.json({ chats });
  } catch (err) {
    console.error("List chats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
