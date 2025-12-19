import { BarChart3, TrendingUp, DollarSign, Calendar } from 'lucide-react';

export default function FinancialsPage() {
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
                        <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">+12.5%</span>
                    </div>
                    <p className="text-gray-400 text-sm">Total Revenue</p>
                    <p className="text-3xl font-bold text-white">₹1,24,500</p>
                </div>

                <div className="glass-card p-6 rounded-2xl bg-[#18181b] border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-xs font-medium text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full">+5.2%</span>
                    </div>
                    <p className="text-gray-400 text-sm">Tickets Sold</p>
                    <p className="text-3xl font-bold text-white">845</p>
                </div>

                <div className="glass-card p-6 rounded-2xl bg-[#18181b] border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                            <Calendar size={24} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm">Active Events</p>
                    <p className="text-3xl font-bold text-white">12</p>
                </div>
            </div>

            {/* Placeholder Chart Area */}
            <div className="glass-card p-8 rounded-2xl bg-[#18181b] border border-white/5 flex flex-col items-center justify-center min-h-[400px]">
                <BarChart3 size={48} className="text-gray-600 mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Revenue Overview</h3>
                <p className="text-gray-500">Chart visualization coming in next update.</p>
            </div>
        </div>
    );
}
