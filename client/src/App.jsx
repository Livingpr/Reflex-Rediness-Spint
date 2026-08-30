import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import RetailerDashboard from "./pages/RetailerDashboard.jsx";
import DispatcherDashboard from "./pages/DispatcherDashboard.jsx";
import RiderDashboard from "./pages/RiderDashboard.jsx";

const HOME_BY_ROLE = { retailer_staff: "/retailer", dispatcher: "/dispatcher", rider: "/rider" };

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/retailer"
            element={
              <ProtectedRoute role="retailer_staff">
                <RetailerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispatcher"
            element={
              <ProtectedRoute role="dispatcher">
                <DispatcherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rider"
            element={
              <ProtectedRoute role="rider">
                <RiderDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
