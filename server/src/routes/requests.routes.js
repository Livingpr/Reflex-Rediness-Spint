import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { generateConfirmationCode } from "../util/confirmationCode.js";
import { broadcastRequestChange } from "../realtime.js";

const REQUEST_SELECT = `
  SELECT
    r.id, r.retailer_id, r.created_by, r.customer_name, r.customer_phone,
    r.address, r.item_description, r.status, r.confirmation_code, r.created_at,
    a.rider_id, ru.name AS rider_name
  FROM delivery_requests r
  LEFT JOIN assignments a ON a.request_id = r.id
  LEFT JOIN users ru ON ru.id = a.rider_id
`;

// Riders never see the confirmation code up front — it's meant to come from
// the customer at drop-off, not be readable from the app before then.
function serializeForRole(request, role) {
  if (role === "rider") {
    const { confirmation_code, ...rest } = request;
    return rest;
  }
  return request;
}

async function fetchRequestById(id) {
  const result = await query(`${REQUEST_SELECT} WHERE r.id = $1`, [id]);
  return result.rows[0] || null;
}

export default function requestsRouter(io) {
  const router = Router();

  // Create a new delivery request (retailer staff only)
  router.post("/", requireAuth, requireRole("retailer_staff"), async (req, res) => {
    const { customer_name, customer_phone, address, item_description } = req.body || {};
    if (!customer_name || !address || !item_description) {
      return res.status(400).json({ error: "customer_name, address, and item_description are required" });
    }

    const confirmationCode = generateConfirmationCode();

    const created = await withTransaction(async (client) => {
      const insert = await client.query(
        `INSERT INTO delivery_requests
           (retailer_id, created_by, customer_name, customer_phone, address, item_description, confirmation_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [req.user.retailer_id, req.user.id, customer_name, customer_phone || null, address, item_description, confirmationCode]
      );
      const requestId = insert.rows[0].id;
      await client.query(
        `INSERT INTO status_updates (request_id, status, updated_by) VALUES ($1, 'Requested', $2)`,
        [requestId, req.user.id]
      );
      return requestId;
    });

    const request = await fetchRequestById(created);
    broadcastRequestChange(io, request);
    res.status(201).json({ request });
  });

  // List requests visible to the current role
  router.get("/", requireAuth, async (req, res) => {
    let where = "";
    let params = [];

    if (req.user.role === "retailer_staff") {
      where = "WHERE r.retailer_id = $1";
      params = [req.user.retailer_id];
    } else if (req.user.role === "rider") {
      where = "WHERE a.rider_id = $1";
      params = [req.user.id];
    }
    // dispatcher sees everything - no WHERE clause

    const result = await query(
      `${REQUEST_SELECT} ${where} ORDER BY r.created_at DESC`,
      params
    );
    const requests = result.rows.map((r) => serializeForRole(r, req.user.role));
    res.json({ requests });
  });

  // Single request with full status history
  router.get("/:id", requireAuth, async (req, res) => {
    const request = await fetchRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const allowed =
      req.user.role === "dispatcher" ||
      (req.user.role === "retailer_staff" && request.retailer_id === req.user.retailer_id) ||
      (req.user.role === "rider" && request.rider_id === req.user.id);
    if (!allowed) return res.status(403).json({ error: "Not authorized to view this request" });

    const history = await query(
      `SELECT su.id, su.status, su.created_at, u.name AS updated_by_name
       FROM status_updates su
       LEFT JOIN users u ON u.id = su.updated_by
       WHERE su.request_id = $1
       ORDER BY su.created_at ASC`,
      [req.params.id]
    );

    res.json({ request: serializeForRole(request, req.user.role), history: history.rows });
  });

  // Dispatcher assigns an available rider to an open request
  router.post("/:id/assign", requireAuth, requireRole("dispatcher"), async (req, res) => {
    const { rider_id } = req.body || {};
    if (!rider_id) return res.status(400).json({ error: "rider_id is required" });

    const request = await fetchRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "Requested") {
      return res.status(409).json({ error: `Request is already ${request.status}` });
    }

    const riderResult = await query(
      "SELECT id, availability FROM users WHERE id = $1 AND role = 'rider'",
      [rider_id]
    );
    const rider = riderResult.rows[0];
    if (!rider) return res.status(404).json({ error: "Rider not found" });
    if (rider.availability !== "available") {
      return res.status(409).json({ error: "That rider is not available" });
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO assignments (request_id, rider_id, assigned_by) VALUES ($1, $2, $3)`,
        [req.params.id, rider_id, req.user.id]
      );
      await client.query(
        `UPDATE delivery_requests SET status = 'Assigned' WHERE id = $1`,
        [req.params.id]
      );
      await client.query(
        `UPDATE users SET availability = 'busy' WHERE id = $1`,
        [rider_id]
      );
      await client.query(
        `INSERT INTO status_updates (request_id, status, updated_by) VALUES ($1, 'Assigned', $2)`,
        [req.params.id, req.user.id]
      );
    });

    const updated = await fetchRequestById(req.params.id);
    broadcastRequestChange(io, updated);
    res.json({ request: updated });
  });

  // Rider advances their own assignment: Assigned -> PickedUp -> Delivered.
  // The final step requires the confirmation code shown to the customer.
  router.post("/:id/advance", requireAuth, requireRole("rider"), async (req, res) => {
    const request = await fetchRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.rider_id !== req.user.id) {
      return res.status(403).json({ error: "This request is not assigned to you" });
    }

    let nextStatus;
    if (request.status === "Assigned") {
      nextStatus = "PickedUp";
    } else if (request.status === "PickedUp") {
      const { confirmation_code } = req.body || {};
      if (!confirmation_code) {
        return res.status(400).json({ error: "confirmation_code is required to mark this delivered" });
      }
      if (confirmation_code.trim().toUpperCase() !== request.confirmation_code) {
        return res.status(400).json({ error: "That confirmation code doesn't match" });
      }
      nextStatus = "Delivered";
    } else {
      return res.status(409).json({ error: `Cannot advance a request that is already ${request.status}` });
    }

    await withTransaction(async (client) => {
      await client.query(`UPDATE delivery_requests SET status = $1 WHERE id = $2`, [nextStatus, req.params.id]);
      await client.query(
        `INSERT INTO status_updates (request_id, status, updated_by) VALUES ($1, $2, $3)`,
        [req.params.id, nextStatus, req.user.id]
      );
      if (nextStatus === "Delivered") {
        await client.query(`UPDATE users SET availability = 'available' WHERE id = $1`, [req.user.id]);
      }
    });

    const updated = await fetchRequestById(req.params.id);
    broadcastRequestChange(io, updated);
    res.json({ request: serializeForRole(updated, "rider") });
  });

  return router;
}
