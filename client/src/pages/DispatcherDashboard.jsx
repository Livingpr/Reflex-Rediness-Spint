import { useEffect, useState, useCallback } from "react";
import NavBar from "../components/NavBar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

export default function DispatcherDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedRider, setSelectedRider] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [ToastEl, showToast] = useToast();

  const refreshRiders = useCallback(() => {
    api.riders().then(({ riders }) => setRiders(riders));
  }, []);

  useEffect(() => {
    api.listRequests().then(({ requests }) => setRequests(requests));
    refreshRiders();
  }, [refreshRiders]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onChange = (updated) => {
      setRequests((prev) => {
        const exists = prev.some((r) => r.id === updated.id);
        if (exists) return prev.map((r) => (r.id === updated.id ? updated : r));
        return [updated, ...prev];
      });
      refreshRiders(); // availability may have changed
    };
    socket.on("request:changed", onChange);
    return () => socket.off("request:changed", onChange);
  }, [refreshRiders]);

  const open = requests.filter((r) => r.status === "Requested");
  const availableRiders = riders.filter((r) => r.availability === "available");

  async function handleAssign(requestId) {
    const riderId = selectedRider[requestId] || availableRiders[0]?.id;
    if (!riderId) return;
    setBusyId(requestId);
    try {
      await api.assignRequest(requestId, riderId);
      const rider = riders.find((r) => r.id === riderId);
      showToast(`Assigned to ${rider?.name || "rider"}`);
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="wrap">
        <div className="page-title"><h1>Dispatcher dashboard</h1></div>
        <p className="page-sub">Logged in as {user.name}</p>

        <div className="grid two">
          <div className="card">
            <h2>Open requests</h2>
            <p className="sub">{open.length} waiting for assignment</p>
            {open.length === 0 && <div className="empty">Queue is clear — nothing waiting on a rider.</div>}
            {open.map((r) => (
              <div className="item" key={r.id}>
                <div className="item-top">
                  <div>
                    <div className="item-title">{r.customer_name}</div>
                    <div className="item-meta">{r.item_description}<br />{r.address}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="item-actions">
                  <select
                    className="inline"
                    value={selectedRider[r.id] || availableRiders[0]?.id || ""}
                    onChange={(e) => setSelectedRider({ ...selectedRider, [r.id]: e.target.value })}
                  >
                    {availableRiders.length === 0 && <option disabled>No riders free</option>}
                    {availableRiders.map((rd) => (
                      <option key={rd.id} value={rd.id}>{rd.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn-sm"
                    disabled={availableRiders.length === 0 || busyId === r.id}
                    onClick={() => handleAssign(r.id)}
                  >
                    {busyId === r.id ? "Assigning..." : "Assign"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Riders</h2>
            <p className="sub">Live availability</p>
            {riders.map((rd) => (
              <div className="rider-row" key={rd.id}>
                <span className="rider-name">{rd.name}</span>
                <span className={`avail ${rd.availability}`}>{rd.availability === "available" ? "Available" : "Busy"}</span>
              </div>
            ))}
          </div>
        </div>
        <footer className="app-footer">Reflex &middot; Dispatcher view</footer>
      </div>
      {ToastEl}
    </div>
  );
}
