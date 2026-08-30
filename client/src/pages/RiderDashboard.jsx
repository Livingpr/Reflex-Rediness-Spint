import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

export default function RiderDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [codeInputs, setCodeInputs] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [errorId, setErrorId] = useState(null);
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
    };
    socket.on("request:changed", onChange);
    return () => socket.off("request:changed", onChange);
  }, []);

  const active = requests.filter((r) => r.status !== "Delivered");
  const delivered = requests.filter((r) => r.status === "Delivered");

  async function handlePickedUp(id) {
    setBusyId(id);
    try {
      await api.advanceRequest(id);
      showToast("Marked picked up");
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirm(id) {
    setBusyId(id);
    setErrorId(null);
    try {
      await api.advanceRequest(id, codeInputs[id] || "");
      showToast("Delivery confirmed");
      setCodeInputs({ ...codeInputs, [id]: "" });
    } catch (err) {
      setErrorId(id);
      showToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="wrap">
        <div className="page-title"><h1>Rider dashboard</h1></div>
        <p className="page-sub">Logged in as {user.name}</p>

        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Your deliveries</h2>
          <p className="sub">Tap to move a delivery to its next state</p>
          {active.length === 0 && <div className="empty">Nothing assigned to you right now.</div>}
          {active.map((r) => (
            <div className="item" key={r.id}>
              <div className="item-top">
                <div>
                  <div className="item-title">{r.customer_name}</div>
                  <div className="item-meta">{r.item_description}<br />{r.address}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="item-actions">
                {r.status === "Assigned" && (
                  <button className="btn-sm" disabled={busyId === r.id} onClick={() => handlePickedUp(r.id)}>
                    {busyId === r.id ? "Updating..." : "Mark picked up"}
                  </button>
                )}
                {r.status === "PickedUp" && (
                  <>
                    <input
                      className="code-input"
                      placeholder="CODE"
                      value={codeInputs[r.id] || ""}
                      onChange={(e) => setCodeInputs({ ...codeInputs, [r.id]: e.target.value })}
                    />
                    <button className="btn-sm" disabled={busyId === r.id} onClick={() => handleConfirm(r.id)}>
                      {busyId === r.id ? "Confirming..." : "Confirm delivery"}
                    </button>
                  </>
                )}
              </div>
              {errorId === r.id && <div className="error-text">That code didn't match — ask the customer to double-check it.</div>}
            </div>
          ))}
        </div>

        {delivered.length > 0 && (
          <div className="card">
            <h2>Delivered today</h2>
            {delivered.map((r) => (
              <div className="item" key={r.id} style={{ opacity: 0.7 }}>
                <div className="item-top">
                  <div>
                    <div className="item-title">{r.customer_name}</div>
                    <div className="item-meta">{r.item_description}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
        <footer className="app-footer">Reflex &middot; Rider view</footer>
      </div>
      {ToastEl}
    </div>
  );
}
