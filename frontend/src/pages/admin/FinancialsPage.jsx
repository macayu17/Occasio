import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, IndianRupee, Calendar, Ticket, Loader2, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function FinancialsPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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

    const fetchFinancials = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const response = await api.get('/admin/financials');
            setData(response.data);
            if (isRefresh) toast.success('Financial data updated');
        } catch (error) {
            toast.error('Failed to load financial data');
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
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
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-[#E23744]" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8 font-['Inter'] relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Financial Analytics</h2>
                    <p className="text-gray-400 mt-1">Track your revenue and sales performance</p>
                </div>
                <button
                    onClick={() => fetchFinancials(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Updating...' : 'Refresh Data'}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-3xl bg-[#18181b]/60 backdrop-blur-xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] -mr-10 -mt-10 transition-opacity group-hover:opacity-100" />

                    <div className="flex items-center justify-between mb-6 relative">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                            <IndianRupee size={24} />
                        </div>
                        {data.revenueGrowth !== 0 && (
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5
                                ${data.revenueGrowth >= 0
                                    ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20'
                                    : 'text-red-400 bg-red-400/10 border border-red-400/20'}`}>
                                {data.revenueGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {data.revenueGrowth >= 0 ? '+' : ''}{data.revenueGrowth}%
                            </span>
                        )}
                    </div>
                    <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Total Revenue</p>
                    <p className="text-4xl font-bold text-white mt-2 tracking-tight">{formatCurrency(data.totalRevenue)}</p>
                </div>

                <div className="glass-card p-6 rounded-3xl bg-[#18181b]/60 backdrop-blur-xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] -mr-10 -mt-10 transition-opacity group-hover:opacity-100" />
                    <div className="flex items-center justify-between mb-6 relative">
                        <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
                            <Ticket size={24} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Tickets Sold</p>
                    <p className="text-4xl font-bold text-white mt-2 tracking-tight">{data.totalTickets.toLocaleString()}</p>
                </div>

                <div className="glass-card p-6 rounded-3xl bg-[#18181b]/60 backdrop-blur-xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[50px] -mr-10 -mt-10 transition-opacity group-hover:opacity-100" />
                    <div className="flex items-center justify-between mb-6 relative">
                        <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20">
                            <Calendar size={24} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Active Events</p>
                    <p className="text-4xl font-bold text-white mt-2 tracking-tight">{data.activeEvents}</p>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="glass-card p-8 rounded-3xl bg-[#18181b]/60 backdrop-blur-xl border border-white/10 shadow-xl">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-[#E23744]/10 rounded-lg text-[#E23744]">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Revenue Overview</h3>
                        <p className="text-sm text-gray-400">Monthly revenue breakdown</p>
                    </div>
                    <span className="text-xs font-medium text-gray-500 ml-auto bg-white/5 px-3 py-1 rounded-full border border-white/5">Last 6 months</span>
                </div>

                {data.revenueChart.length > 0 ? (
                    <div className="space-y-6">
                        {/* Chart */}
                        <div className="flex items-end justify-between gap-2 md:gap-4 h-80 px-4 pb-2 border-b border-white/5 relative">
                            {/* Grid lines (visual only) */}
                            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-10">
                                <div className="border-t border-white w-full h-px"></div>
                                <div className="border-t border-white w-full h-px"></div>
                                <div className="border-t border-white w-full h-px"></div>
                                <div className="border-t border-white w-full h-px"></div>
                                <div className="border-t border-white w-full h-px"></div>
                            </div>

                            {data.revenueChart.map((item) => {
                                const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                                return (
                                    <div key={item.month} className="flex-1 flex flex-col items-center gap-3 z-10 group">
                                        <div className="relative w-full flex justify-end flex-col h-full group-hover:-translate-y-1 transition-transform duration-300">
                                            <div
                                                className="w-full bg-gradient-to-t from-[#E23744]/40 to-[#E23744] rounded-t-lg transition-all duration-700 relative overflow-hidden"
                                                style={{
                                                    height: `${Math.max(height, 2)}%`,
                                                    minHeight: item.revenue > 0 ? '20px' : '4px'
                                                }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>

                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#18181b] border border-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-xl whitespace-nowrap z-20 pointer-events-none transform translate-y-2 group-hover:translate-y-0">
                                                {formatCurrency(item.revenue)}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#18181b]"></div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-gray-500 group-hover:text-white transition-colors uppercase">{formatMonth(item.month)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary */}
                        <div className="flex items-center justify-between pt-2">
                            <div className="text-sm text-gray-400">
                                Total Period Revenue: <span className="text-white font-bold ml-1">{formatCurrency(data.totalRevenue)}</span>
                            </div>
                            <div className="text-sm text-gray-400">
                                Monthly Average: <span className="text-white font-bold ml-1">
                                    {formatCurrency(data.totalRevenue / Math.max(data.revenueChart.length, 1))}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-80 text-gray-500 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                        <div className="p-4 rounded-full bg-white/5 mb-4">
                            <BarChart3 size={32} className="opacity-50" />
                        </div>
                        <p className="font-medium text-white">No revenue data available</p>
                        <p className="text-sm mt-1 mb-6 max-w-xs text-center">Start selling tickets to visualize your financial growth here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
