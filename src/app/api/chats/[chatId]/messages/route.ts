import { NextResponse } from "next/server";
import { store } from "../../../store";

/**
 * GET /api/chats/[chatId]/messages
 *
 * Query params:
 *   limit  — max messages to return (default 50, max 100)
 *   before — message ID; return only messages older than this one (cursor pagination)
 *
 * Returns messages in ascending (chronological) order.
 * Fetch the LAST `limit` messages on initial load, then pass the
 * oldest message's id as `before` to load the page above it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
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

    const { chatId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const before = searchParams.get("before") ?? undefined;

    // Get all messages for this chat (already sorted ascending by store)
    let all = store.getMessagesForChat(chatId);

    // Apply cursor: keep only messages whose timestamp is BEFORE the cursor message
    if (before) {
      const cursorMsg = all.find((m) => m.id === before);
      if (cursorMsg) {
        all = all.filter(
          (m) => new Date(m.timestamp) < new Date(cursorMsg.timestamp)
        );
      }
    }

    // Take the LAST `limit` messages (most recent slice) and return ascending
    const page = all.slice(-limit);

    return NextResponse.json({
      messages: page,
      hasMore: all.length > limit,
    });
  } catch (err) {
    console.error("List messages error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
