import { NextResponse } from "next/server";
import { store } from "../store";

export async function GET() {
  try {
    const users = store.getAllUsers().map((u) => ({
      id: u.id,
      name: u.username,
      email: u.phone_number,
      username: u.username,
      phone_number: u.phone_number,
      avatar_url: u.avatar_url,
      status: "online",
    }));

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
