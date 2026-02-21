import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrendingUp, Users, IndianRupee, Calendar, CheckCircle, XCircle,
  Clock, Ticket, Tag, CreditCard, BarChart3, ArrowUpRight, ArrowDownRight,
  Percent, UserCheck, Zap
} from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, all

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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E23744] border-r-2 border-[#E23744]/30"></div>
      </div>
    );
  }

  if (!analytics) return <div className="text-gray-400 text-center py-12">No analytics data available</div>;

  const filteredDaily = filterTimeSeries(analytics.dailyRegistrations, timeRange);
  const filteredRevenue = filterTimeSeries(analytics.dailyRevenue, timeRange);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Event Analytics</h1>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {[['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTimeRange(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeRange === val ? 'bg-[#E23744] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Overview Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<Users size={20} />}
          color="blue"
          title="Registrations"
          value={analytics.totalRegistrations}
          sub={analytics.registrationGrowth !== 0
            ? `${analytics.registrationGrowth > 0 ? '+' : ''}${analytics.registrationGrowth}% vs last week`
            : null}
          trend={analytics.registrationGrowth > 0 ? 'up' : analytics.registrationGrowth < 0 ? 'down' : null}
        />
        <StatCard
          icon={<IndianRupee size={20} />}
          color="green"
          title="Revenue"
          value={`₹${formatNum(analytics.totalRevenue)}`}
          sub={`Avg ₹${formatNum(analytics.averageOrderValue)}`}
        />
        <StatCard
          icon={<Percent size={20} />}
          color="purple"
          title="Conversion"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          sub={`${analytics.paidRegistrations} of ${analytics.totalRegistrations}`}
        />
        <StatCard
          icon={<UserCheck size={20} />}
          color="cyan"
          title="Checked In"
          value={analytics.checkedInCount}
          sub={`${analytics.checkInRate.toFixed(1)}% of ${analytics.totalTickets} tickets`}
        />
        <StatCard
          icon={<Ticket size={20} />}
          color="orange"
          title="Tickets Issued"
          value={analytics.totalTickets}
          sub={analytics.capacityUsed !== null ? `${analytics.capacityUsed}% capacity` : null}
        />
        <StatCard
          icon={<Tag size={20} />}
          color="pink"
          title="Discounts Used"
          value={analytics.totalDiscountUses}
          sub={analytics.discountSavings > 0 ? `₹${formatNum(analytics.discountSavings)} saved` : null}
        />
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Timeline */}
        <GlassCard title="Registration Timeline" icon={<BarChart3 size={18} />}>
          <TimelineChart data={filteredDaily} labelKey="date" valueKey="count" color="#E23744" />
        </GlassCard>

        {/* Revenue Timeline */}
        <GlassCard title="Revenue Timeline" icon={<IndianRupee size={18} />}>
          <TimelineChart data={filteredRevenue} labelKey="date" valueKey="amount" color="#22c55e" prefix="₹" />
        </GlassCard>
      </div>

      {/* ─── Hourly Distribution + Payment Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Heatmap */}
        <GlassCard
          title="Registration by Hour"
          icon={<Clock size={18} />}
          badge={analytics.peakHour?.count > 0 ? `Peak: ${formatHour(analytics.peakHour.hour)}` : null}
        >
          <div className="grid grid-cols-12 gap-1">
            {analytics.hourlyDistribution?.map(h => {
              const max = Math.max(...analytics.hourlyDistribution.map(x => x.count), 1);
              const intensity = h.count / max;
              return (
                <div key={h.hour} className="flex flex-col items-center gap-1" title={`${formatHour(h.hour)}: ${h.count} registrations`}>
                  <div
                    className="w-full aspect-square rounded-sm transition-colors"
                    style={{
                      backgroundColor: intensity > 0
                        ? `rgba(226, 55, 68, ${0.15 + intensity * 0.85})`
                        : 'rgba(255,255,255,0.03)'
                    }}
                  />
                  <span className="text-[9px] text-gray-500">{h.hour % 6 === 0 ? formatHour(h.hour) : ''}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>12 AM</span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(226,55,68,0.15)' }} /> Low
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(226,55,68,1)' }} /> High
            </span>
            <span>11 PM</span>
          </div>
        </GlassCard>

        {/* Payment Status */}
        <GlassCard title="Registration Status" icon={<CreditCard size={18} />}>
          <div className="space-y-3">
            <StatusBar label="Paid" count={analytics.paidRegistrations} total={analytics.totalRegistrations} color="green" icon={<CheckCircle size={16} />} />
            <StatusBar label="Pending" count={analytics.pendingRegistrations} total={analytics.totalRegistrations} color="yellow" icon={<Clock size={16} />} />
            <StatusBar label="Failed" count={analytics.failedRegistrations} total={analytics.totalRegistrations} color="red" icon={<XCircle size={16} />} />
            {analytics.cancelledRegistrations > 0 && (
              <StatusBar label="Cancelled" count={analytics.cancelledRegistrations} total={analytics.totalRegistrations} color="gray" icon={<XCircle size={16} />} />
            )}
          </div>
        </GlassCard>
      </div>

      {/* ─── Tier Breakdown + Discount Usage ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Tiers */}
        {analytics.tierBreakdown?.length > 0 && (
          <GlassCard title="Ticket Tiers" icon={<Ticket size={18} />}>
            <div className="space-y-4">
              {analytics.tierBreakdown.map(tier => (
                <div key={tier.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{tier.name}</span>
                    <span className="text-gray-400">
                      {tier.soldCount}{tier.capacity ? `/${tier.capacity}` : ''} sold
                      <span className="text-gray-500 ml-2">₹{formatNum(tier.revenue)}</span>
                    </span>
                  </div>
                  {tier.capacity && (
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(tier.fillRate, 100)}%`,
                          background: tier.fillRate > 90 ? '#ef4444'
                            : tier.fillRate > 70 ? '#f59e0b'
                            : '#22c55e'
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Discount Codes */}
        {analytics.discountUsage?.length > 0 && (
          <GlassCard title="Discount Codes" icon={<Tag size={18} />}>
            <div className="space-y-3">
              {analytics.discountUsage.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <code className="text-sm font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded">{d.code}</code>
                    <span className="text-xs text-gray-500">
                      {d.type === 'PERCENTAGE' ? `${d.amount}% off` : `₹${(d.amount / 100).toFixed(0)} off`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-white font-medium">{d.usedCount}</span>
                    <span className="text-xs text-gray-500">{d.maxUses ? ` / ${d.maxUses}` : ''} uses</span>
                  </div>
                </div>
              ))}
              {analytics.discountSavings > 0 && (
                <div className="text-xs text-gray-500 text-right mt-1">
                  Total savings: <span className="text-purple-300">₹{formatNum(analytics.discountSavings)}</span>
                </div>
              )}
            </div>
          </GlassCard>
        )}
      </div>

      {/* ─── Check-in Stats ─── */}
      <GlassCard title="Check-in Overview" icon={<UserCheck size={18} />}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="text-3xl font-bold text-green-400 mb-1">{analytics.checkedInCount}</div>
            <div className="text-xs text-gray-400">Checked In</div>
          </div>
          <div className="text-center p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-3xl font-bold text-gray-300 mb-1">{analytics.notCheckedInCount}</div>
            <div className="text-xs text-gray-400">Not Checked In</div>
          </div>
          <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="text-3xl font-bold text-blue-400 mb-1">{analytics.checkInRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-400">Check-in Rate</div>
          </div>
          <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <div className="text-3xl font-bold text-purple-400 mb-1">{analytics.totalTickets}</div>
            <div className="text-xs text-gray-400">Total Tickets</div>
          </div>
        </div>

        {/* Check-in Timeline */}
        {analytics.checkinTimeline?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Check-in Timeline</h4>
            <div className="flex items-end gap-[2px] h-24">
              {analytics.checkinTimeline.map((pt, i) => {
                const max = Math.max(...analytics.checkinTimeline.map(p => p.count), 1);
                return (
                  <div
                    key={i}
                    className="flex-1 bg-green-500/60 rounded-t-sm hover:bg-green-400 transition-colors"
                    style={{ height: `${(pt.count / max) * 100}%` }}
                    title={`${format(new Date(pt.time), 'HH:mm')} — ${pt.count} check-ins (${pt.cumulative} total)`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>{analytics.checkinTimeline.length > 0 ? format(new Date(analytics.checkinTimeline[0].time), 'HH:mm') : ''}</span>
              <span>{analytics.checkinTimeline.length > 0 ? format(new Date(analytics.checkinTimeline[analytics.checkinTimeline.length - 1].time), 'HH:mm') : ''}</span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* ─── Payment Provider + Capacity ─── */}
      {(analytics.providerBreakdown && Object.keys(analytics.providerBreakdown).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard title="Payment Providers" icon={<CreditCard size={18} />}>
            <div className="space-y-3">
              {Object.entries(analytics.providerBreakdown).map(([provider, data]) => (
                <div key={provider} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-white font-medium">{provider}</span>
                  <div className="text-right">
                    <span className="text-sm text-white">{data.count} orders</span>
                    <span className="text-xs text-gray-500 ml-2">₹{formatNum(data.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {analytics.capacityUsed !== null && (
            <GlassCard title="Venue Capacity" icon={<Users size={18} />}>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/5"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="text-[#E23744]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(analytics.capacityUsed, 100)}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{analytics.capacityUsed}%</span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  {analytics.totalRegistrations} / {analytics.eventCapacity} spots filled
                </p>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ─── Recent Registrations ─── */}
      <GlassCard title="Recent Registrations" icon={<Users size={18} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-white/5">
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Email</th>
                <th className="text-left py-2 pr-4">Ticket</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2 pr-4">Amount</th>
                <th className="text-right py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analytics.recentRegistrations?.map((reg, index) => (
                <tr key={index} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 pr-4">
                    <span className="text-white font-medium">{reg.attendeeName}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-400 truncate max-w-[180px]">{reg.email}</td>
                  <td className="py-2.5 pr-4">
                    {reg.ticketId ? (
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">{reg.ticketId}</code>
                        {reg.checkedIn && <CheckCircle size={12} className="text-green-400" />}
                      </div>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      reg.status === 'PAID' ? 'bg-green-500/10 text-green-400' :
                      reg.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' :
                      reg.status === 'CANCELLED' ? 'bg-gray-500/10 text-gray-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {reg.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-300">
                    {reg.amount ? `₹${formatNum(reg.amount)}` : '—'}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    {format(new Date(reg.createdAt), 'MMM dd, HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!analytics.recentRegistrations || analytics.recentRegistrations.length === 0) && (
            <p className="text-gray-500 text-center py-8">No registrations yet</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Utility Components ───

function GlassCard({ title, icon, badge, children }) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#18181b]/60 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          {title}
        </h2>
        {badge && (
          <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatCard({ icon, color, title, value, sub, trend }) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400',
    green: 'from-green-500/20 to-green-500/5 border-green-500/20 text-green-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
    orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/20 text-orange-400',
    pink: 'from-pink-500/20 to-pink-500/5 border-pink-500/20 text-pink-400',
  };
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br border ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="opacity-70">{icon}</span>
        {trend && (
          trend === 'up'
            ? <ArrowUpRight size={14} className="text-green-400" />
            : <ArrowDownRight size={14} className="text-red-400" />
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-gray-400">{title}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBar({ label, count, total, color, icon }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const colorMap = {
    green: { bg: 'bg-green-500/10', border: 'border-green-500/20', bar: 'bg-green-500', text: 'text-green-400' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', bar: 'bg-yellow-500', text: 'text-yellow-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', bar: 'bg-red-500', text: 'text-red-400' },
    gray: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', bar: 'bg-gray-500', text: 'text-gray-400' },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <div className={`p-3 ${c.bg} border ${c.border} rounded-xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 ${c.text}`}>
          {icon}
          <span className="font-medium text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${c.text}`}>{count}</span>
          <span className="text-xs text-gray-500">({pct.toFixed(1)}%)</span>
        </div>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TimelineChart({ data, labelKey, valueKey, color, prefix = '' }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-8 text-sm">No data available</p>;
  }
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  // Show last portion based on space
  const chartData = data.length > 15 ? data.slice(-15) : data;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-32">
        {chartData.map((d, i) => {
          const pct = (d[valueKey] / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm hover:opacity-80 transition-all cursor-default"
              style={{
                height: `${Math.max(pct, 2)}%`,
                backgroundColor: pct > 0 ? color : 'rgba(255,255,255,0.03)',
                opacity: 0.5 + (pct / 200)
              }}
              title={`${format(new Date(d[labelKey]), 'MMM dd')}: ${prefix}${formatNum(d[valueKey])}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1.5">
        <span>{chartData.length > 0 ? format(new Date(chartData[0][labelKey]), 'MMM dd') : ''}</span>
        <span>{chartData.length > 0 ? format(new Date(chartData[chartData.length - 1][labelKey]), 'MMM dd') : ''}</span>
      </div>
      <div className="text-right text-xs text-gray-500 mt-1">
        Total: {prefix}{formatNum(data.reduce((s, d) => s + d[valueKey], 0))}
      </div>
    </div>
  );
}

// ─── Helpers ───

function filterTimeSeries(data, range) {
  if (!data) return [];
  if (range === 'all') return data;
  const days = range === '7d' ? 7 : 30;
  return data.slice(-days);
}

function formatHour(hour) {
  if (hour === 0) return '12A';
  if (hour === 12) return '12P';
  return hour < 12 ? `${hour}A` : `${hour - 12}P`;
}

function formatNum(n) {
  if (n === null || n === undefined) return '0';
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
