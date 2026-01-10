import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, IndianRupee, TrendingUp, Shield } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

import BroadcastModal from '../../components/BroadcastModal';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    publishedEvents: 0,
    totalRegistrations: 0,
    totalRevenue: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/admin/events');
      const events = response.data;

      setRecentEvents(events.slice(0, 5));

      const totalRegistrations = events.reduce(
        (sum, event) => sum + (event._count?.registrations || 0),
        0
      );

      const totalRevenue = events.reduce(
        (sum, event) => sum + (event._count?.registrations || 0) * event.priceCents,
        0
      );

      setStats({
        totalEvents: events.length,
        publishedEvents: events.filter(e => e.published).length,
        totalRegistrations,
        totalRevenue: totalRevenue / 100
      });
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E23744] border-r-2 border-[#E23744]/30"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">
              {isAdmin ? 'Super Admin Overview' : 'My Overview'}
            </h1>
            {isAdmin && (
              <span className="px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full flex items-center gap-1">
                <Shield size={12} /> ADMIN
              </span>
            )}
          </div>
          <p className="text-gray-400">
            {isAdmin
              ? 'Viewing all events across all organizers.'
              : 'Welcome to your command center.'}
          </p>
        </div>
        <button
          onClick={() => setIsBroadcastOpen(true)}
          className="btn btn-primary"
        >
          📢 Broadcast Email
        </button>
      </div>

      <BroadcastModal isOpen={isBroadcastOpen} onClose={() => setIsBroadcastOpen(false)} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Calendar}
          label={isAdmin ? "All Events" : "Total Events"}
          value={stats.totalEvents}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Published"
          value={stats.publishedEvents}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Registrations"
          value={stats.totalRegistrations}
          color="purple"
        />
        <StatCard
          icon={IndianRupee}
          label="Total Revenue"
          value={`₹${stats.totalRevenue.toFixed(2)}`}
          color="yellow"
        />
      </div>

      {/* Recent Events */}
      <div className="glass-card p-6 rounded-2xl bg-[#18181b]/60 border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {isAdmin ? 'All Recent Events' : 'Recent Events'}
          </h2>
          <Link to="/admin/events" className="text-[#E23744] hover:text-[#E23744]/80 text-sm font-medium transition-colors">
            View All Events
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="text-gray-500" size={24} />
            </div>
            <p className="text-gray-400 mb-4">No events created yet</p>
            <Link to="/admin/events/create" className="btn btn-primary inline-flex">
              Create Event
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event, index) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white group-hover:text-[#E23744] transition-colors mb-1">{event.title}</h3>
                    {isAdmin && event.organizer && (
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                        by {event.organizer.name || event.organizer.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-sm text-gray-500 gap-4">
                    <span>{event.location}</span>
                    <span>•</span>
                    <span className={event.published ? 'text-green-500' : 'text-yellow-500'}>
                      {event.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-200">{event._count?.registrations || 0}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Sold</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  // Simplistic color map consistent with dark theme
  const colors = {
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-emerald-500 bg-emerald-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
    yellow: 'text-yellow-500 bg-yellow-500/10'
  };

  return (
    <div className="glass-card p-6 rounded-2xl bg-[#18181b]/60 border border-white/5 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={24} />
      </div>
    </div>
  );
}

