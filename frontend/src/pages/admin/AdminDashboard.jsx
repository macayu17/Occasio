import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, DollarSign, TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    publishedEvents: 0,
    totalRegistrations: 0,
    totalRevenue: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/admin/events');
      const events = response.data;

      setRecentEvents(events.slice(0, 5));

      // Calculate stats
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
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your events.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Calendar}
          label="Total Events"
          value={stats.totalEvents}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Published Events"
          value={stats.publishedEvents}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Total Registrations"
          value={stats.totalRegistrations}
          color="purple"
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={`₹${stats.totalRevenue.toFixed(2)}`}
          color="yellow"
        />
      </div>

      {/* Recent Events */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Recent Events</h2>
          <Link to="/admin/events" className="text-primary-600 hover:text-primary-700 font-medium">
            View All →
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No events yet</p>
            <Link to="/admin/events/create" className="btn btn-primary mt-4">
              Create Your First Event
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-sm text-gray-600">{event.location}</p>
                </div>
                <div className="text-right">
                  <span className={`badge ${event.published ? 'badge-success' : 'badge-warning'}`}>
                    {event.published ? 'Published' : 'Draft'}
                  </span>
                  <p className="text-sm text-gray-600 mt-1">
                    {event._count?.registrations || 0} registrations
                  </p>
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
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500'
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`${colors[color]} p-3 rounded-lg`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}
