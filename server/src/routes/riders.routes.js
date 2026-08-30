import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();

router.get("/", requireAuth, requireRole("dispatcher"), async (_req, res) => {
  const result = await query(
    "SELECT id, name, phone, availability FROM users WHERE role = 'rider' ORDER BY name"
  );
  res.json({ riders: result.rows });
});

export default router;
