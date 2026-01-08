import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, Ticket, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function FinancialsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        totalRevenue: 0,
        totalTickets: 0,
        activeEvents: 0,
        revenueGrowth: 0,
        revenueChart: []
    });

    useEffect(() => {
        fetchFinancials();
    }, []);

    const fetchFinancials = async () => {
        try {
            const response = await api.get('/admin/financials');
            setData(response.data);
        } catch (error) {
            toast.error('Failed to load financial data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatMonth = (monthStr) => {
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'short' });
    };

    // Get max revenue for chart scaling
    const maxRevenue = Math.max(...data.revenueChart.map(d => d.revenue), 1);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-[#E23744]" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Financial Analytics</h2>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl bg-[#18181b] border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                            <DollarSign size={24} />
                        </div>
                        {data.revenueGrowth !== 0 && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1
                                ${data.revenueGrowth >= 0
                                    ? 'text-emerald-500 bg-emerald-500/10'
                                    : 'text-red-500 bg-red-500/10'}`}>
                                {data.revenueGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {data.revenueGrowth >= 0 ? '+' : ''}{data.revenueGrowth}%
                            </span>
                        )}
                    </div>
                    <p className="text-gray-400 text-sm">Total Revenue</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(data.totalRevenue)}</p>
                </div>

                <div className="glass-card p-6 rounded-2xl bg-[#18181b] border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                            <Ticket size={24} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm">Tickets Sold</p>
                    <p className="text-3xl font-bold text-white">{data.totalTickets.toLocaleString()}</p>
                </div>

                <div className="glass-card p-6 rounded-2xl bg-[#18181b] border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                            <Calendar size={24} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm">Active Events</p>
                    <p className="text-3xl font-bold text-white">{data.activeEvents}</p>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="glass-card p-8 rounded-2xl bg-[#18181b] border border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <BarChart3 size={24} className="text-[#E23744]" />
                    <h3 className="text-xl font-medium text-white">Revenue Overview</h3>
                    <span className="text-sm text-gray-500 ml-auto">Last 6 months</span>
                </div>

                {data.revenueChart.length > 0 ? (
                    <div className="space-y-4">
                        {/* Chart */}
                        <div className="flex items-end justify-between gap-4 h-64 px-4">
                            {data.revenueChart.map((item, index) => {
                                const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                                return (
                                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className="w-full bg-gradient-to-t from-[#E23744] to-[#E23744]/60 rounded-t-lg transition-all duration-500 hover:from-[#E23744] hover:to-[#E23744]/80 relative group"
                                            style={{
                                                height: `${Math.max(height, 2)}%`,
                                                minHeight: item.revenue > 0 ? '20px' : '4px'
                                            }}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {formatCurrency(item.revenue)}
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-500">{formatMonth(item.month)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div className="text-sm text-gray-400">
                                Total: <span className="text-white font-medium">{formatCurrency(data.totalRevenue)}</span>
                            </div>
                            <div className="text-sm text-gray-400">
                                Avg/month: <span className="text-white font-medium">
                                    {formatCurrency(data.totalRevenue / Math.max(data.revenueChart.length, 1))}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <BarChart3 size={48} className="mb-4 opacity-50" />
                        <p>No revenue data yet</p>
                        <p className="text-sm mt-1">Start selling tickets to see your revenue chart!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
