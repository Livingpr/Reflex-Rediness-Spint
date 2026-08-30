import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// Public on purpose: the sign-up form needs to list retailers so a new
// retailer_staff account can pick which shop it belongs to.
router.get("/", async (_req, res) => {
  const result = await query(
    "SELECT id, shop_name, phone, address FROM retailers ORDER BY shop_name"
  );
  res.json({ retailers: result.rows });
});

export default router;
