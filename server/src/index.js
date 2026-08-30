import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import "dotenv/config";
import "express-async-errors";

import authRoutes from "./routes/auth.routes.js";
import retailersRoutes from "./routes/retailers.routes.js";
import ridersRoutes from "./routes/riders.routes.js";
import requestsRouter from "./routes/requests.routes.js";
import { attachRealtime } from "./realtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN; // set in dev when client runs on a different port

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: CLIENT_ORIGIN ? { origin: CLIENT_ORIGIN } : undefined,
});

app.use(cors(CLIENT_ORIGIN ? { origin: CLIENT_ORIGIN } : undefined));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/retailers", retailersRoutes);
app.use("/api/riders", ridersRoutes);
app.use("/api/requests", requestsRouter(io));

attachRealtime(io);

// In production, one Render Web Service serves both the API above and the
// built React app below, so there's only one URL and no CORS to worry about.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

// Centralized error handler - keeps route handlers free of try/catch boilerplate
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

server.listen(PORT, () => {
  console.log(`Reflex server listening on port ${PORT}`);
});
