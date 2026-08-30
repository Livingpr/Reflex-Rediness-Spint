import { verifyToken } from "./auth.js";

// Each connected socket joins a room based on its role, so the server can
// push updates only to the sessions that are allowed to see them:
//   retailer_staff -> retailer:<retailer_id>   (their own shop's requests)
//   dispatcher     -> dispatchers               (every open/assigned request)
//   rider          -> rider:<user_id>           (their own assignments)
export function attachRealtime(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Missing auth token"));
      const payload = verifyToken(token);
      socket.user = { id: payload.sub, role: payload.role, retailer_id: payload.retailer_id };
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const { id, role, retailer_id } = socket.user;
    if (role === "retailer_staff" && retailer_id) socket.join(`retailer:${retailer_id}`);
    if (role === "dispatcher") socket.join("dispatchers");
    if (role === "rider") socket.join(`rider:${id}`);
  });
}

export function emitToRetailer(io, retailerId, event, payload) {
  io.to(`retailer:${retailerId}`).emit(event, payload);
}
export function emitToDispatchers(io, event, payload) {
  io.to("dispatchers").emit(event, payload);
}
export function emitToRider(io, riderId, event, payload) {
  io.to(`rider:${riderId}`).emit(event, payload);
}

// Broadcast a request change to every session allowed to see it: the
// retailer it belongs to, all dispatchers, and its assigned rider (if any).
export function broadcastRequestChange(io, request) {
  emitToRetailer(io, request.retailer_id, "request:changed", request);
  emitToDispatchers(io, "request:changed", request);
  if (request.rider_id) emitToRider(io, request.rider_id, "request:changed", request);
}
