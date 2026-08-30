import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

const HOME_BY_ROLE = { retailer_staff: "/retailer", dispatcher: "/dispatcher", rider: "/rider" };

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [retailers, setRetailers] = useState([]);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", role: "retailer_staff", retailer_id: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.retailers().then(({ retailers }) => {
      setRetailers(retailers);
      if (retailers.length) setForm((f) => ({ ...f, retailer_id: retailers[0].id }));
    });
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { ...form };
      if (payload.role !== "retailer_staff") delete payload.retailer_id;
      const user = await signup(payload);
      navigate(HOME_BY_ROLE[user.role] || "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-wrap">
      <h1 style={{ marginBottom: 6 }}>Reflex</h1>
      <p className="page-sub">Create an account</p>
      <form className="card" onSubmit={handleSubmit}>
        <label>I am a...</label>
        <select value={form.role} onChange={(e) => update("role", e.target.value)}>
          <option value="retailer_staff">Retailer staff</option>
          <option value="dispatcher">Dispatcher</option>
          <option value="rider">Rider</option>
        </select>

        {form.role === "retailer_staff" && (
          <>
            <label>Shop</label>
            <select value={form.retailer_id} onChange={(e) => update("retailer_id", e.target.value)}>
              {retailers.map((r) => (
                <option key={r.id} value={r.id}>{r.shop_name}</option>
              ))}
            </select>
          </>
        )}

        <label>Full name</label>
        <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
        <label>Phone</label>
        <input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="07xx xxx xxx" />
        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} minLength={8} required />

        {error && <div className="error-text">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Creating account..." : "Sign up"}</button>
      </form>
      <p className="form-footer">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
