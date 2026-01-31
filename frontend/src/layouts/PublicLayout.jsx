import { Outlet, Link } from 'react-router-dom';
import { Compass, Menu, X, Ticket, Sparkles } from 'lucide-react';
import { useState } from 'react';
import FloatingLines from '../components/FloatingLines';

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-white selection:bg-[#E23744] selection:text-white relative overflow-x-hidden font-['Outfit']">
      {/* --- Universal Dynamic Background --- */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        {/* Floating Lines */}
        <div className="absolute inset-0 opacity-30">
          <FloatingLines
            linesGradient={['#333333', '#111111', '#E23744', '#1a1a1a']}
            enabledWaves={['top', 'bottom']}
            lineCount={[6, 8]}
            lineDistance={[10, 15]}
            animationSpeed={0.3}
            interactive={true}
            mixBlendMode="lighten"
          />
        </div>

        {/* Ambient Gradient Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-[#E23744]/10 rounded-full blur-[120px]" />
      </div>

      {/* Premium Glass Header */}
      <nav className="glass-nav sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo Area */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#E23744] text-white shadow-[0_0_20px_rgba(226,55,68,0.4)] group-hover:scale-105 transition-transform duration-300">
                  <Ticket size={20} fill="currentColor" className="transform -rotate-12" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-white group-hover:text-gray-200 transition-colors">
                  Occasio
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Explore
              </Link>
              <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Organizer Login
              </Link>
              <Link
                to="/register"
                className="btn btn-primary shadow-red-500/20"
              >
                Sign Up
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#09090b]">
            <div className="px-4 pt-4 pb-6 space-y-3">
              <Link
                to="/"
                className="block px-4 py-3 text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white rounded-xl"
                onClick={() => setMobileMenuOpen(false)}
              >
                Explore Events
              </Link>
              <Link
                to="/login"
                className="block px-4 py-3 text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white rounded-xl"
                onClick={() => setMobileMenuOpen(false)}
              >
                Organizer Login
              </Link>
              <Link
                to="/register"
                className="block px-4 py-3 text-base font-medium text-white bg-[#E23744] hover:bg-[#d12c39] rounded-xl text-center mt-4"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Modern Minimal Footer */}
      <footer className="border-t border-white/5 bg-[#09090b] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E23744] flex items-center justify-center text-white">
                <Ticket size={16} fill="currentColor" className="transform -rotate-12" />
              </div>
              <span className="text-lg font-bold text-gray-200">Occasio</span>
            </div>

            <div className="flex gap-8 text-sm text-gray-500">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>

            <div className="text-sm text-gray-600">
              © 2025 Occasio Events
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
