import { useAuth } from "../context/AuthContext.jsx";

const ROLE_LABELS = { retailer_staff: "Retailer", dispatcher: "Dispatcher", rider: "Rider" };

export default function NavBar() {
  const { user, logout } = useAuth();
  return (
    <header className="navbar">
      <div>
        <span className="logo">Reflex</span>
        {user && <span className="who"> &nbsp;{user.name} &middot; {ROLE_LABELS[user.role]}</span>}
      </div>
      <div className="right">
        <span className="sync-pill"><span className="dot"></span>Live</span>
        {user && <button className="link" onClick={logout}>Log out</button>}
      </div>
    </header>
  );
}
