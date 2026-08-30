import { io } from "socket.io-client";

let socket = null;

// Connects (or reconnects with a fresh token) and returns the shared socket
// instance. In dev this hits Vite's proxy at /socket.io -> localhost:4000;
// in production it's same-origin, since Express serves both.
export function connectSocket(token) {
  if (socket) {
    socket.disconnect();
  }
  socket = io({ auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
