import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";

// Components
import { MainLayout } from "./layout/MainLayout";

// Pages
import { Home } from "./pages/Home";
import { SearchResults } from "./pages/SearchResults";
import { Routes as RoutesPage } from "./pages/Routes";
import { SelectSeats } from "./pages/SelectSeats";
import { PassengerDetails } from "./pages/PassengerDetails";
import { Payment } from "./pages/Payment";
import { Confirmation } from "./pages/Confirmation";
import { MyBookings } from "./pages/MyBookings";
import { Cancellation } from "./pages/Cancellation";
import { AdminPortal } from "./pages/AdminPortal";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { OperatorPortal } from "./pages/OperatorPortal";
import { Profile } from "./pages/Profile";

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (allowedRoles && user) {
    const userRole = user.role?.toUpperCase();
    const isAllowed = allowedRoles.some(role => role.toUpperCase() === userRole);
    if (!isAllowed) return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/booking/select-seats/:trip_id"
          element={<SelectSeats />}
        />

        <Route
          path="/booking/passengers"
          element={
            <ProtectedRoute>
              <PassengerDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/payment/:booking_id"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/confirmation/:booking_id"
          element={
            <ProtectedRoute>
              <Confirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/cancel/:booking_id"
          element={
            <ProtectedRoute>
              <Cancellation />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Operator Portal Route */}
      <Route 
        path="/operator/*" 
        element={
          <ProtectedRoute allowedRoles={["OPERATOR", "ADMIN"]}>
            <OperatorPortal />
          </ProtectedRoute>
        } 
      />

      {/* Admin Portal Route */}
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminPortal />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;
