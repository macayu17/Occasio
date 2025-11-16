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
      <div className="flex justify-center py-20">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-900"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold gradient-text mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">Welcome back! Here's an overview of your events.</p>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Events</h2>
          <Link to="/admin/events" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold inline-flex items-center">
            View All →
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto text-gray-400 dark:text-gray-600 mb-4" size={48} />
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-lg">No events yet</p>
            <Link to="/admin/events/create" className="btn btn-primary">
              Create Your First Event
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event, index) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all hover:shadow-md animate-slide-up"
                style={{animationDelay: `${index * 50}ms`}}
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{event.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{event.location}</p>
                </div>
                <div className="text-right ml-4">
                  <span className={`badge ${event.published ? 'badge-success' : 'badge-warning'} mb-2`}>
                    {event.published ? 'Published' : 'Draft'}
                  </span>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
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
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    purple: 'from-purple-500 to-pink-500',
    yellow: 'from-yellow-500 to-orange-500'
  };

  const iconBg = {
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    green: 'bg-green-100 dark:bg-green-900/30',
    purple: 'bg-purple-100 dark:bg-purple-900/30',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30'
  };

  const iconColor = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    yellow: 'text-yellow-600 dark:text-yellow-400'
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors[color]} opacity-10 rounded-full -mr-16 -mt-16`}></div>
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`${iconBg[color]} p-4 rounded-xl`}>
          <Icon size={28} className={iconColor[color]} />
        </div>
      </div>
    </div>
  );
}
