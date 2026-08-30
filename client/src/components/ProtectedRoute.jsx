import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const HOME_BY_ROLE = { retailer_staff: "/retailer", dispatcher: "/dispatcher", rider: "/rider" };

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}
