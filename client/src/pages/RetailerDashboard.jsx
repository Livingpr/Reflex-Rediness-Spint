import { useEffect, useState, useCallback } from "react";
import NavBar from "../components/NavBar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function RetailerDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", address: "", item_description: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ToastEl, showToast] = useToast();

  useEffect(() => {
    api.listRequests().then(({ requests }) => setRequests(requests));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onChange = (updated) => {
      setRequests((prev) => {
        const exists = prev.some((r) => r.id === updated.id);
        if (exists) return prev.map((r) => (r.id === updated.id ? updated : r));
        return [updated, ...prev];
      });
      showToast(`${updated.customer_name} is now ${updated.status}`);
    };
    socket.on("request:changed", onChange);
    return () => socket.off("request:changed", onChange);
  }, [showToast]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setBusy(true);
      try {
        await api.createRequest(form);
        setForm({ customer_name: "", customer_phone: "", address: "", item_description: "" });
        showToast("Request logged");
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [form, showToast]
  );

  return (
    <div>
      <NavBar />
      <div className="wrap">
        <div className="page-title"><h1>Retailer dashboard</h1></div>
        <p className="page-sub">Logged in as {user.name}</p>

        <div className="grid two">
          <div className="card">
            <h2>New delivery request</h2>
            <p className="sub">Logged by retailer staff</p>
            <form onSubmit={handleSubmit}>
              <label>Customer name</label>
              <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="e.g. Sarah M." required />
              <label>Phone</label>
              <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="07xx xxx xxx" />
              <label>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Kikuyu Town, near the market" required />
              <label>Item</label>
              <input value={form.item_description} onChange={(e) => setForm({ ...form, item_description: e.target.value })} placeholder="What's being delivered?" required />
              {error && <div className="error-text">{error}</div>}
              <button className="primary" type="submit" disabled={busy}>{busy ? "Logging..." : "Log delivery request"}</button>
            </form>
          </div>

          <div className="card">
            <h2>Your requests</h2>
            <p className="sub">Status updates arrive here the moment a rider changes them — no calling to check</p>
            {requests.length === 0 && <div className="empty">No requests yet — log one on the left.</div>}
            {requests.map((r) => (
              <div className="item" key={r.id}>
                <div className="item-top">
                  <div>
                    <div className="item-title">{r.customer_name}</div>
                    <div className="item-meta">{r.item_description}<br />{r.address}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status !== "Delivered" && (
                  <div className="confirm-code-banner">Confirmation code for the customer: {r.confirmation_code}</div>
                )}
                <div className="item-meta" style={{ marginTop: 9 }}>
                  Last update: {timeAgo(r.created_at)}{r.rider_name ? ` · Rider: ${r.rider_name}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
        <footer className="app-footer">Reflex &middot; Retailer view</footer>
      </div>
      {ToastEl}
    </div>
  );
}
