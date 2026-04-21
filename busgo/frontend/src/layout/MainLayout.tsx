import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { LogOut, User, Menu, X } from "lucide-react";
import { useState } from "react";

export function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-red-600">BusGo</span>
            </Link>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link to="/my-bookings" className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium">
                  My Bookings
                </Link>
                <div className="relative group">
                  <button className="flex items-center space-x-1 text-gray-700 hover:text-red-600">
                    <User className="h-5 w-5" />
                    <span>{user?.name || "Profile"}</span>
                  </button>
                  <div className="absolute right-0 w-48 mt-2 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="py-1">
                      <button onClick={handleLogout} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium font-semibold">
                  Log in
                </Link>
                <Link to="/register" className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium transition">
                  Register
                </Link>
              </>
            )}
          </div>
          
          <div className="-mr-2 flex items-center sm:hidden">
            <button
               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
               className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-t">
          <div className="pt-2 pb-3 space-y-1">
            {isAuthenticated ? (
              <>
                <Link to="/my-bookings" className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-red-600 hover:bg-gray-50">
                  My Bookings
                </Link>
                <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 hover:text-red-600 hover:bg-gray-50">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-red-600 hover:bg-gray-50">
                  Log in
                </Link>
                <Link to="/register" className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-red-600 hover:bg-gray-50">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-8 text-center mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} BusGo. All rights reserved.
        </p>
      </div>
    </footer>
  );
}