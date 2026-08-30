import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { signToken, requireAuth } from "../auth.js";

const router = Router();

const PUBLIC_USER_FIELDS =
  "id, email, role, name, phone, retailer_id, availability, created_at";

router.post("/signup", async (req, res) => {
  const { email, password, name, phone, role, retailer_id } = req.body || {};

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: "email, password, name, and role are required" });
  }
  if (!["retailer_staff", "dispatcher", "rider"].includes(role)) {
    return res.status(400).json({ error: "role must be retailer_staff, dispatcher, or rider" });
  }
  if (role === "retailer_staff" && !retailer_id) {
    return res.status(400).json({ error: "retailer_id is required for retailer_staff" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rows.length) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const availability = role === "rider" ? "available" : null;

  const result = await query(
    `INSERT INTO users (email, password_hash, role, name, phone, retailer_id, availability)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_USER_FIELDS}`,
    [email.toLowerCase(), passwordHash, role, name, phone || null, retailer_id || null, availability]
  );

  const user = result.rows[0];
  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const result = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const { password_hash, ...publicUser } = user;
  const token = signToken(publicUser);
  res.json({ token, user: publicUser });
});

router.get("/me", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ user: result.rows[0] });
});

export default router;
