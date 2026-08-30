import bcrypt from "bcryptjs";
import { pool } from "../src/db.js";
import { generateConfirmationCode } from "../src/util/confirmationCode.js";
import "dotenv/config";

const DEMO_PASSWORD = "password123"; // every seeded account uses this - it's a demo

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Clearing existing demo data...");
    await client.query("DELETE FROM status_updates");
    await client.query("DELETE FROM assignments");
    await client.query("DELETE FROM delivery_requests");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM retailers");

    console.log("Seeding retailer...");
    const retailer = await client.query(
      `INSERT INTO retailers (shop_name, phone, address)
       VALUES ('Jaza Electronics', '0711 222 333', 'Kikuyu Town, Kiambu County')
       RETURNING id`
    );
    const retailerId = retailer.rows[0].id;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    async function createUser({ email, name, phone, role, availability }) {
      const result = await client.query(
        `INSERT INTO users (email, password_hash, role, name, phone, retailer_id, availability)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          email,
          passwordHash,
          role,
          name,
          phone,
          role === "retailer_staff" ? retailerId : null,
          availability || null,
        ]
      );
      return result.rows[0].id;
    }

    console.log("Seeding users...");
    const staffId = await createUser({
      email: "staff@jaza.demo",
      name: "Wanjiru M.",
      phone: "0711 000 001",
      role: "retailer_staff",
    });
    const dispatcherId = await createUser({
      email: "dispatcher@reflex.demo",
      name: "Otieno K.",
      phone: "0722 000 002",
      role: "dispatcher",
    });
    const rider1 = await createUser({
      email: "brian@reflex.demo",
      name: "Brian O.",
      phone: "0733 000 003",
      role: "rider",
      availability: "busy",
    });
    const rider2 = await createUser({
      email: "faith@reflex.demo",
      name: "Faith M.",
      phone: "0744 000 004",
      role: "rider",
      availability: "busy",
    });
    const rider3 = await createUser({
      email: "dennis@reflex.demo",
      name: "Dennis K.",
      phone: "0755 000 005",
      role: "rider",
      availability: "available",
    });

    console.log("Seeding delivery requests...");
    async function createRequest({ customer_name, customer_phone, address, item_description }) {
      const result = await client.query(
        `INSERT INTO delivery_requests
           (retailer_id, created_by, customer_name, customer_phone, address, item_description, confirmation_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [retailerId, staffId, customer_name, customer_phone, address, item_description, generateConfirmationCode()]
      );
      const requestId = result.rows[0].id;
      await client.query(
        `INSERT INTO status_updates (request_id, status, updated_by) VALUES ($1, 'Requested', $2)`,
        [requestId, staffId]
      );
      return requestId;
    }

    async function assign(requestId, riderId) {
      await client.query(
        `INSERT INTO assignments (request_id, rider_id, assigned_by) VALUES ($1, $2, $3)`,
        [requestId, riderId, dispatcherId]
      );
      await client.query(`UPDATE delivery_requests SET status = 'Assigned' WHERE id = $1`, [requestId]);
      await client.query(
        `INSERT INTO status_updates (request_id, status, updated_by) VALUES ($1, 'Assigned', $2)`,
        [requestId, dispatcherId]
      );
    }

    async function markPickedUp(requestId, riderId) {
      await client.query(`UPDATE delivery_requests SET status = 'PickedUp' WHERE id = $1`, [requestId]);
      await client.query(
        `INSERT INTO status_updates (request_id, status, updated_by) VALUES ($1, 'PickedUp', $2)`,
        [requestId, riderId]
      );
    }

    const req1 = await createRequest({
      customer_name: "Amina W.",
      customer_phone: "0712 345 001",
      address: "Kikuyu Town, Stage 3",
      item_description: "Phone charger + earbuds",
    });

    const req2 = await createRequest({
      customer_name: "Peter K.",
      customer_phone: "0722 118 442",
      address: "Kinoo Rd, near mosque",
      item_description: "LED bulb pack (x6)",
    });
    await assign(req2, rider2);

    const req3 = await createRequest({
      customer_name: "Grace N.",
      customer_phone: "0733 990 210",
      address: "Thogoto, opp. clinic",
      item_description: "Bluetooth speaker",
    });
    await assign(req3, rider1);
    await markPickedUp(req3, rider1);

    await client.query("COMMIT");
    console.log("\nSeed complete. Demo accounts (all use password: %s):", DEMO_PASSWORD);
    console.log("  retailer_staff -> staff@jaza.demo");
    console.log("  dispatcher     -> dispatcher@reflex.demo");
    console.log("  rider          -> brian@reflex.demo / faith@reflex.demo / dennis@reflex.demo");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
