import bcrypt from "bcryptjs";
import { pool } from "./pool";

async function seed() {
  console.log("Seeding database…\n");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear existing data
    await client.query("DELETE FROM otp_codes");
    await client.query("DELETE FROM messages");
    await client.query("DELETE FROM conversation_members");
    await client.query("DELETE FROM conversations");
    await client.query("DELETE FROM users");

    // Create demo users with phone numbers
    const password = await bcrypt.hash("password123", 10);
    const users = [];

    const demoUsers = [
      { username: "alice", phone: "+1234567890" },
      { username: "bob", phone: "+1234567891" },
      { username: "charlie", phone: "+1234567892" },
      { username: "diana", phone: "+1234567893" },
      { username: "edward", phone: "+1234567894" },
      { username: "fiona", phone: "+1234567895" },
      { username: "george", phone: "+1234567896" },
      { username: "hannah", phone: "+1234567897" },
    ];

    for (const { username, phone } of demoUsers) {
      const result = await client.query(
        "INSERT INTO users (username, password_hash, phone_number) VALUES ($1, $2, $3) RETURNING id, username",
        [username, password, phone]
      );
      users.push(result.rows[0]);
    }

    console.log(`✓ Created ${users.length} users (password: password123, OTP also works)`);

    // Create direct conversations
    const convos = [];

    // alice ↔ bob
    const c1 = await client.query(
      "INSERT INTO conversations (type) VALUES ('direct') RETURNING id"
    );
    await client.query(
      "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
      [c1.rows[0].id, users[0].id, users[1].id]
    );
    convos.push(c1.rows[0]);

    // alice ↔ charlie
    const c2 = await client.query(
      "INSERT INTO conversations (type) VALUES ('direct') RETURNING id"
    );
    await client.query(
      "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
      [c2.rows[0].id, users[0].id, users[2].id]
    );
    convos.push(c2.rows[0]);

    // alice ↔ diana
    const c3 = await client.query(
      "INSERT INTO conversations (type) VALUES ('direct') RETURNING id"
    );
    await client.query(
      "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
      [c3.rows[0].id, users[0].id, users[3].id]
    );
    convos.push(c3.rows[0]);

    // Group: "Team Chat" — alice, bob, charlie, diana
    const c4 = await client.query(
      "INSERT INTO conversations (type, name) VALUES ('group', 'Team Chat') RETURNING id"
    );
    for (const u of users.slice(0, 4)) {
      await client.query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)",
        [c4.rows[0].id, u.id]
      );
    }
    convos.push(c4.rows[0]);

    // Group: "Design Review" — alice, edward, fiona
    const c5 = await client.query(
      "INSERT INTO conversations (type, name) VALUES ('group', 'Design Review') RETURNING id"
    );
    for (const u of [users[0], users[4], users[5]]) {
      await client.query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)",
        [c5.rows[0].id, u.id]
      );
    }
    convos.push(c5.rows[0]);

    console.log(`✓ Created ${convos.length} conversations (3 direct, 2 group)`);

    // Seed messages
    let msgCount = 0;

    // Messages for alice ↔ bob
    const aliceBobMsgs = [
      { sender: 0, content: "Hey Bob, how's the project going?" },
      { sender: 1, content: "Going well! Just finished the API endpoints." },
      { sender: 0, content: "Nice. Can you review my PR when you get a chance?" },
      { sender: 1, content: "Sure, I'll take a look this afternoon." },
      { sender: 0, content: "Thanks! Let me know if you have questions." },
    ];
    for (const msg of aliceBobMsgs) {
      await client.query(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)",
        [convos[0].id, users[msg.sender].id, msg.content]
      );
      msgCount++;
    }

    // Messages for alice ↔ charlie
    const aliceCharlieMsgs = [
      { sender: 2, content: "Alice, did you see the new design specs?" },
      { sender: 0, content: "Yes! They look great. Love the color scheme." },
      { sender: 2, content: "Thanks! I spent a lot of time on the typography." },
    ];
    for (const msg of aliceCharlieMsgs) {
      await client.query(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)",
        [convos[1].id, users[msg.sender].id, msg.content]
      );
      msgCount++;
    }

    // Messages for Team Chat group
    const teamMsgs = [
      { sender: 0, content: "Welcome to Team Chat, everyone! 🎉" },
      { sender: 1, content: "Glad to be here!" },
      { sender: 3, content: "Let's ship great things together!" },
      { sender: 2, content: "Ready to roll! 🚀" },
      { sender: 0, content: "Sprint planning at 3pm today." },
    ];
    for (const msg of teamMsgs) {
      await client.query(
        "INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)",
        [convos[3].id, users[msg.sender].id, msg.content]
      );
      msgCount++;
    }

    await client.query("COMMIT");

    console.log(`✓ Seeded ${msgCount} messages`);
    console.log("\n🎉 Seed complete!\n");
    console.log("Demo accounts (password: password123):");
    console.log("  alice (+1234567890), bob (+1234567891), charlie (+1234567892), diana (+1234567893)");
    console.log("  edward (+1234567894), fiona (+1234567895), george (+1234567896), hannah (+1234567897)");
    console.log("\nOTP login: Enter any of the phone numbers above to receive a code (shown in console)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
