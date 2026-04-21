import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";

// Components
import { MainLayout } from "./layout/MainLayout";

// Pages
import { Home } from "./pages/Home";
import { SearchResults } from "./pages/SearchResults";
import { SelectSeats } from "./pages/SelectSeats";
import { PassengerDetails } from "./pages/PassengerDetails";
import { Payment } from "./pages/Payment";
import { Confirmation } from "./pages/Confirmation";
import { MyBookings } from "./pages/MyBookings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { OperatorPortal } from "./pages/OperatorPortal";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
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
      </Route>

      {/* Operator Portal Route */}
      <Route path="/operator/*" element={<OperatorPortal />} />
    </Routes>
  );
}

export default App;
