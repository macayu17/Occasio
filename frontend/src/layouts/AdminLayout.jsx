import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  LayoutDashboard,
  FileText,
  LogOut,
  Menu,
  X,
  Plus
} from 'lucide-react';
import { useState } from 'react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Events', href: '/admin/events', icon: Calendar },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b">
            <Link to="/admin" className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-primary-500" />
              <span className="text-xl font-bold">EventHub</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}

            <Link
              to="/admin/events/create"
              className="flex items-center space-x-3 px-4 py-3 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors mt-4"
              onClick={() => setSidebarOpen(false)}
            >
              <Plus size={20} />
              <span className="font-medium">Create Event</span>
            </Link>
          </nav>

          {/* User section */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="bg-white border-b h-16 flex items-center px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-4"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            Admin Panel
          </h1>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
