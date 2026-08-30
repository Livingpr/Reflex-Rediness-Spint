import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const HOME_BY_ROLE = { retailer_staff: "/retailer", dispatcher: "/dispatcher", rider: "/rider" };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
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
      <p className="page-sub">Log in to your account</p>
      <form className="card" onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required />
        {error && <div className="error-text">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
      </form>
      <p className="form-footer">No account? <Link to="/signup">Sign up</Link></p>
    </div>
  );
}
