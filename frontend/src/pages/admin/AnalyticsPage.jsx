import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { TrendingUp, Users, IndianRupee, Calendar, CheckCircle, XCircle } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [id]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get(`/admin/events/${id}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
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

  if (!analytics) return <div>No analytics data available</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Event Analytics</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Users className="text-blue-500" />}
          title="Total Registrations"
          value={analytics?.totalRegistrations || 0}
          trend={`${analytics?.registrationGrowth > 0 ? '+' : ''}${analytics?.registrationGrowth || 0}%`}
        />
        <StatCard
          icon={<CheckCircle className="text-green-500" />}
          title="Paid Registrations"
          value={analytics?.paidRegistrations || 0}
          trend={`${analytics?.totalRegistrations > 0 ? ((analytics.paidRegistrations / analytics.totalRegistrations) * 100).toFixed(1) : 0}%`}
        />
        <StatCard
          icon={<IndianRupee className="text-purple-500" />}
          title="Total Revenue"
          value={`₹${(analytics?.totalRevenue || 0).toFixed(2)}`}
          trend={`Avg: ₹${(analytics?.averageOrderValue || 0).toFixed(2)}`}
        />
        <StatCard
          icon={<TrendingUp className="text-orange-500" />}
          title="Conversion Rate"
          value={`${(analytics?.conversionRate || 0).toFixed(1)}%`}
          trend="Payment Success"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Registration Timeline */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Registration Timeline</h2>
          <div className="space-y-3">
            {analytics?.dailyRegistrations && analytics.dailyRegistrations.length > 0 ? (
              analytics.dailyRegistrations.map((day, index) => (
                <div key={index} className="flex items-center">
                  <span className="text-sm text-gray-600 w-24">
                    {format(new Date(day.date), 'MMM dd')}
                  </span>
                  <div className="flex-1 mx-4">
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500"
                        style={{
                          width: `${(day.count / Math.max(...analytics.dailyRegistrations.map(d => d.count), 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{day.count}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No registration data yet</p>
            )}
          </div>
        </div>

        {/* Payment Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Payment Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="text-green-500" size={24} />
                <span className="font-medium">Paid</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {analytics?.paidRegistrations || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Calendar className="text-yellow-500" size={24} />
                <span className="font-medium">Pending</span>
              </div>
              <span className="text-2xl font-bold text-yellow-600">
                {analytics?.pendingRegistrations || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <XCircle className="text-red-500" size={24} />
                <span className="font-medium">Failed</span>
              </div>
              <span className="text-2xl font-bold text-red-600">
                {analytics?.failedRegistrations || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Check-in Stats */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Check-in Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {analytics?.checkedInCount || 0}
            </div>
            <div className="text-sm text-gray-600">Checked In</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-gray-600 mb-2">
              {analytics?.notCheckedInCount || 0}
            </div>
            <div className="text-sm text-gray-600">Not Checked In</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {(analytics?.checkInRate || 0).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Check-in Rate</div>
          </div>
        </div>
      </div>

      {/* Recent Attendees (if needed) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Registrations</h2>
        <div className="space-y-3">
          {analytics?.recentRegistrations && analytics.recentRegistrations.length > 0 ? (
            analytics.recentRegistrations.map((reg, index) => (
              <div key={index} className="flex items-center justify-between p-3 border-b">
                <div>
                  <div className="font-medium">{reg.attendeeName}</div>
                  <div className="text-sm text-gray-500">{reg.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {format(new Date(reg.createdAt), 'MMM dd, HH:mm')}
                  </div>
                  <div className={`text-xs ${reg.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                    {reg.status}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">No registrations yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, trend }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-100 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="text-xs text-gray-500">{trend}</div>
    </div>
  );
}
