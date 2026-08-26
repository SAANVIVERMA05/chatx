import { Router, Request, Response } from "express";
import { pool } from "../db/pool";
import { authenticate, AuthRequest } from "../middleware";

const router = Router();
router.use(authenticate);

// ── POST /api/keys ──────────────────────────────────────────────
// Upload a user's initial key bundle
router.post("/", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const { identityKey, signedPrekey, oneTimePrekeys } = req.body;

  if (!identityKey || !signedPrekey || !Array.isArray(oneTimePrekeys)) {
    return res.status(400).json({ error: "Invalid key bundle format" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Upsert public keys
    await client.query(
      `
      INSERT INTO public_keys (user_id, identity_key, signed_prekey, signed_prekey_sig, signed_prekey_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        identity_key = EXCLUDED.identity_key,
        signed_prekey = EXCLUDED.signed_prekey,
        signed_prekey_sig = EXCLUDED.signed_prekey_sig,
        signed_prekey_id = EXCLUDED.signed_prekey_id
      `,
      [
        userId,
        identityKey,
        signedPrekey.publicKey,
        signedPrekey.signature,
        signedPrekey.id,
      ]
    );

    // Delete old OPKs and insert new ones
    await client.query(`DELETE FROM one_time_prekeys WHERE user_id = $1`, [userId]);

    for (const opk of oneTimePrekeys) {
      await client.query(
        `INSERT INTO one_time_prekeys (user_id, key_id, public_key) VALUES ($1, $2, $3)`,
        [userId, opk.id, opk.publicKey]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving keys:", err);
    res.status(500).json({ error: "Failed to save keys" });
  } finally {
    client.release();
  }
});

// ── GET /api/keys/:userId ───────────────────────────────────────
// Fetch a user's prekey bundle to start an X3DH session
router.get("/:userId", async (req: Request, res: Response) => {
  const targetUserId = req.params.userId;

  try {
    const pkRes = await pool.query(
      `SELECT identity_key, signed_prekey, signed_prekey_sig, signed_prekey_id FROM public_keys WHERE user_id = $1`,
      [targetUserId]
    );

    if (pkRes.rows.length === 0) {
      return res.status(404).json({ error: "User keys not found" });
    }

    const keys = pkRes.rows[0];

    // Pop one OPK (simulate taking one, delete it so it's one-time)
    const opkRes = await pool.query(
      `
      DELETE FROM one_time_prekeys
      WHERE id = (
        SELECT id FROM one_time_prekeys WHERE user_id = $1 LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING key_id, public_key
      `,
      [targetUserId]
    );

    let opk = null;
    if (opkRes.rows.length > 0) {
      opk = {
        id: opkRes.rows[0].key_id,
        publicKey: opkRes.rows[0].public_key,
      };
    }

    res.json({
      identityKey: keys.identity_key,
      signedPrekey: {
        id: keys.signed_prekey_id,
        publicKey: keys.signed_prekey,
        signature: keys.signed_prekey_sig,
      },
      oneTimePrekey: opk,
    });
  } catch (err) {
    console.error("Error fetching keys:", err);
    res.status(500).json({ error: "Failed to fetch keys" });
  }
});

export default router;
