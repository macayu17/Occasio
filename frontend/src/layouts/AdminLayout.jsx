import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Plus,
  Ticket,
  BarChart3,
  QrCode,
  Users
} from 'lucide-react';
import { useState } from 'react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Events', href: '/admin/events', icon: Calendar },
    { name: 'Team Events', href: '/admin/team-events', icon: Users },
    { name: 'Financials', href: '/admin/financials', icon: BarChart3 },
    { name: 'Scanner', href: '/scanner', icon: QrCode },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-[#E23744] selection:text-white">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 glass-nav border-r border-white/5 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full bg-[#09090b]/80 backdrop-blur-xl">
          {/* Logo */}
          <div className="flex items-center h-20 px-8 border-b border-white/5">
            <Link to="/admin" className="flex items-center gap-3 group">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#E23744] text-white shadow-lg shadow-red-900/20">
                <Ticket size={16} fill="currentColor" className="transform -rotate-12" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Occasio Admin
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden ml-auto p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${active
                    ? 'bg-[#E23744] text-white shadow-lg shadow-red-900/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            <div className="pt-8 mt-4 border-t border-white/5">
              <Link
                to="/admin/events/create"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:border-[#E23744] hover:text-[#E23744] transition-all group"
                onClick={() => setSidebarOpen(false)}
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#E23744] group-hover:text-white transition-colors">
                  <Plus size={16} />
                </div>
                <span className="font-medium">Create Event</span>
              </Link>
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-white/5">
            <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72 min-h-screen">
        {/* Top bar */}
        <header className="glass-nav h-20 flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Menu size={24} className="text-white" />
          </button>
          <div className="flex items-center justify-between w-full">
            <h1 className="text-xl font-bold text-white">
              {navigation.find(n => n.href === location.pathname)?.name || 'Admin Panel'}
            </h1>
            <a href="/" target="_blank" className="text-sm text-gray-500 hover:text-[#E23744] transition-colors">
              View Site
            </a>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
