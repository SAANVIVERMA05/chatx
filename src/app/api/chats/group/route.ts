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
    const { name, memberIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 1) {
      return NextResponse.json({ error: "At least 1 other member is required" }, { status: 400 });
    }

    const chat = store.createGroupChat(name.trim(), userId, memberIds);
    if (!chat) {
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
    }

    return NextResponse.json({
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
      lastMessage: null,
    });
  } catch (err) {
    console.error("Create group error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
