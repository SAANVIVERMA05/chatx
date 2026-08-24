import { NextResponse } from "next/server";
import { store } from "../../store";

export async function POST(request: Request) {
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

    const body = await request.json();
    const { phone_number, user_id } = body;

    // Find the target user
    let targetUser;
    if (user_id) {
      targetUser = store.getAllUsers().find((u) => u.id === user_id);
    } else if (phone_number) {
      targetUser = store.findUserByPhone(phone_number);
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === userId) {
      return NextResponse.json({ error: "Cannot chat with yourself" }, { status: 400 });
    }

    // Create or find existing direct chat
    const chat = store.createDirectChat(userId, targetUser.id);
    if (!chat) {
      return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });
    }

    return NextResponse.json({
      chat: {
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
            }
          : null,
      },
    });
  } catch (err) {
    console.error("Create chat error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
