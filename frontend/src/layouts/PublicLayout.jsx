import { Outlet, Link } from 'react-router-dom';
import { Calendar, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <Calendar className="h-8 w-8 text-primary-500" />
                <span className="text-xl font-bold text-gray-900">EventHub</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <Link to="/" className="text-gray-700 hover:text-primary-500 px-3 py-2">
                Events
              </Link>
              <Link to="/login" className="text-gray-700 hover:text-primary-500 px-3 py-2">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary">
                Get Started
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-700"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                to="/"
                className="block px-3 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Events
              </Link>
              <Link
                to="/login"
                className="block px-3 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="block px-3 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p>&copy; 2024 EventHub. All rights reserved.</p>
            <p className="text-gray-400 text-sm mt-2">
              Event Management & Booking System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
