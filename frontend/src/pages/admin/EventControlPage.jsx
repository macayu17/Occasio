import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Users, QrCode, BarChart3, Palette,
    Search, Check, X, RotateCcw, LogIn, LogOut,
    Clock, UserCheck, UserX, RefreshCw
} from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'checkin', label: 'Check-in', icon: QrCode },
    { id: 'attendees', label: 'Attendees', icon: Users },
    { id: 'style', label: 'Ticket Style', icon: Palette }
];

export default function EventControlPage() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [attendees, setAttendees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchEvent();
        fetchStats();
    }, [eventId]);

    useEffect(() => {
        if (activeTab === 'attendees' || activeTab === 'checkin') {
            fetchAttendees();
        }
    }, [activeTab, statusFilter]);

    const fetchEvent = async () => {
        try {
            const res = await api.get(`/admin/events`);
            const found = res.data.find(e => e.id === eventId);
            setEvent(found);
        } catch (error) {
            toast.error('Failed to load event');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await api.get(`/admin/events/${eventId}/checkin-stats`);
            setStats(res.data);
        } catch (error) {
            console.error('Failed to fetch stats');
        }
    };

    const fetchAttendees = async () => {
        try {
            const status = statusFilter !== 'all' ? statusFilter : undefined;
            const res = await api.get(`/admin/events/${eventId}/attendees`, {
                params: { status }
            });
            setAttendees(res.data);
        } catch (error) {
            console.error('Failed to fetch attendees');
        }
    };

    const handleCheckIn = async (ticketId) => {
        try {
            await api.post(`/admin/tickets/${ticketId}/checkin`);
            toast.success('Checked in');
            fetchAttendees();
            fetchStats();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Check-in failed');
        }
    };

    const handleCheckOut = async (ticketId) => {
        try {
            await api.post(`/admin/tickets/${ticketId}/checkout`);
            toast.success('Checked out');
            fetchAttendees();
            fetchStats();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Check-out failed');
        }
    };

    const handleReset = async (ticketId) => {
        try {
            await api.post(`/admin/tickets/${ticketId}/reset-checkin`);
            toast.success('Reset successful');
            fetchAttendees();
            fetchStats();
        } catch (error) {
            toast.error('Reset failed');
        }
    };

    const filteredAttendees = attendees.filter(a =>
        a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/admin/events" className="btn btn-ghost">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{event?.title}</h1>
                        <p className="text-gray-400 text-sm">Event Control Center</p>
                    </div>
                </div>
                <button onClick={() => { fetchStats(); fetchAttendees(); }} className="btn btn-secondary">
                    <RefreshCw size={18} />
                    Refresh
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white text-black'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <OverviewTab stats={stats} event={event} />
            )}

            {activeTab === 'checkin' && (
                <CheckinTab
                    attendees={filteredAttendees}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    onReset={handleReset}
                    stats={stats}
                />
            )}

            {activeTab === 'attendees' && (
                <AttendeesTab
                    attendees={filteredAttendees}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                />
            )}

            {activeTab === 'style' && (
                <TicketStyleTab eventId={eventId} currentStyle={event?.ticketStyle} />
            )}
        </div>
    );
}

// Overview Tab Component
function OverviewTab({ stats, event }) {
    if (!stats) return <div className="text-gray-400">Loading stats...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                label="Total Tickets"
                value={stats.total}
                icon={Users}
            />
            <StatCard
                label="Checked In"
                value={stats.checkedIn}
                subtext={`${stats.checkInRate}%`}
                icon={UserCheck}
                color="green"
            />
            <StatCard
                label="Not Checked In"
                value={stats.notCheckedIn}
                icon={UserX}
                color="orange"
            />
            <StatCard
                label="Currently Inside"
                value={stats.currentlyInside}
                icon={LogIn}
                color="blue"
            />
        </div>
    );
}

function StatCard({ label, value, subtext, icon: Icon, color = 'gray' }) {
    const colors = {
        gray: 'bg-white/5 text-white',
        green: 'bg-emerald-500/10 text-emerald-400',
        orange: 'bg-orange-500/10 text-orange-400',
        blue: 'bg-blue-500/10 text-blue-400'
    };

    return (
        <div className={`card p-6 ${colors[color]}`}>
            <div className="flex items-center gap-3 mb-2">
                <Icon size={20} className="opacity-60" />
                <span className="text-sm text-gray-400">{label}</span>
            </div>
            <p className="text-3xl font-bold">{value}</p>
            {subtext && <p className="text-sm opacity-60 mt-1">{subtext}</p>}
        </div>
    );
}

// Check-in Tab Component
function CheckinTab({ attendees, searchTerm, setSearchTerm, statusFilter, setStatusFilter, onCheckIn, onCheckOut, onReset, stats }) {
    return (
        <div className="space-y-6">
            {/* Quick Stats */}
            {stats && (
                <div className="flex gap-4 flex-wrap">
                    <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg">
                        <span className="font-bold">{stats.checkedIn}</span> checked in
                    </div>
                    <div className="bg-orange-500/10 text-orange-400 px-4 py-2 rounded-lg">
                        <span className="font-bold">{stats.notCheckedIn}</span> pending
                    </div>
                    <div className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg">
                        <span className="font-bold">{stats.currentlyInside}</span> inside now
                    </div>
                </div>
            )}

            {/* Search & Filter */}
            <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="input w-auto"
                >
                    <option value="all">All</option>
                    <option value="not-checked-in">Not Checked In</option>
                    <option value="checked-in">Checked In</option>
                    <option value="checked-out">Checked Out</option>
                </select>
            </div>

            {/* Attendee List */}
            <div className="space-y-2">
                {attendees.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No attendees found</p>
                ) : (
                    attendees.map(attendee => (
                        <div key={attendee.id} className="card flex items-center justify-between p-4">
                            <div>
                                <p className="font-medium text-white">{attendee.name}</p>
                                <p className="text-sm text-gray-400">{attendee.email}</p>
                                {attendee.checkedInAt && (
                                    <p className="text-xs text-emerald-400 mt-1">
                                        Checked in: {format(new Date(attendee.checkedInAt), 'MMM d, h:mm a')}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {!attendee.checkedInAt ? (
                                    <button
                                        onClick={() => onCheckIn(attendee.ticketId)}
                                        className="btn btn-primary px-4 py-2"
                                    >
                                        <LogIn size={16} />
                                        Check In
                                    </button>
                                ) : !attendee.checkedOutAt ? (
                                    <button
                                        onClick={() => onCheckOut(attendee.ticketId)}
                                        className="btn btn-secondary px-4 py-2"
                                    >
                                        <LogOut size={16} />
                                        Check Out
                                    </button>
                                ) : (
                                    <span className="badge badge-neutral">Completed</span>
                                )}
                                {attendee.checkedInAt && (
                                    <button
                                        onClick={() => onReset(attendee.ticketId)}
                                        className="btn btn-ghost px-2"
                                        title="Reset"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Attendees Tab Component
function AttendeesTab({ attendees, searchTerm, setSearchTerm, statusFilter, setStatusFilter }) {
    return (
        <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="input w-auto"
                >
                    <option value="all">All Attendees</option>
                    <option value="not-checked-in">Not Checked In</option>
                    <option value="checked-in">Checked In</option>
                </select>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 text-left">
                            <th className="p-4 text-sm font-medium text-gray-400">Name</th>
                            <th className="p-4 text-sm font-medium text-gray-400">Email</th>
                            <th className="p-4 text-sm font-medium text-gray-400">Status</th>
                            <th className="p-4 text-sm font-medium text-gray-400">Check-in Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendees.map(a => (
                            <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="p-4 text-white">{a.name}</td>
                                <td className="p-4 text-gray-400">{a.email}</td>
                                <td className="p-4">
                                    {a.checkedInAt ? (
                                        a.checkedOutAt ? (
                                            <span className="badge badge-neutral">Left</span>
                                        ) : (
                                            <span className="badge badge-success">Inside</span>
                                        )
                                    ) : (
                                        <span className="badge badge-warning">Pending</span>
                                    )}
                                </td>
                                <td className="p-4 text-gray-400 text-sm">
                                    {a.checkedInAt ? format(new Date(a.checkedInAt), 'MMM d, h:mm a') : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Ticket Style Tab Component
function TicketStyleTab({ eventId, currentStyle }) {
    const [style, setStyle] = useState(currentStyle || {
        template: 'modern',
        primaryColor: '#E23744',
        accentColor: '#ffffff',
        showLogo: true
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/admin/events/${eventId}/ticket-style`, { ticketStyle: style });
            toast.success('Ticket style saved');
        } catch (error) {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div className="card p-6 space-y-6">
                <h3 className="text-lg font-semibold text-white">Customize Ticket Design</h3>

                {/* Template Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Template</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['modern', 'minimal', 'classic'].map(t => (
                            <button
                                key={t}
                                onClick={() => setStyle({ ...style, template: t })}
                                className={`p-4 rounded-lg border-2 transition-all capitalize ${style.template === t
                                        ? 'border-[#E23744] bg-[#E23744]/10'
                                        : 'border-white/10 hover:border-white/20'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Primary Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={style.primaryColor}
                                onChange={e => setStyle({ ...style, primaryColor: e.target.value })}
                                className="w-12 h-12 rounded-lg cursor-pointer"
                            />
                            <input
                                type="text"
                                value={style.primaryColor}
                                onChange={e => setStyle({ ...style, primaryColor: e.target.value })}
                                className="input flex-1"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Accent Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={style.accentColor}
                                onChange={e => setStyle({ ...style, accentColor: e.target.value })}
                                className="w-12 h-12 rounded-lg cursor-pointer"
                            />
                            <input
                                type="text"
                                value={style.accentColor}
                                onChange={e => setStyle({ ...style, accentColor: e.target.value })}
                                className="input flex-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Preview</label>
                    <div
                        className="rounded-xl p-6 border border-white/10"
                        style={{ backgroundColor: style.primaryColor + '20' }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-xl font-bold" style={{ color: style.primaryColor }}>Event Ticket</h4>
                                <p className="text-sm text-gray-400">Your event name here</p>
                            </div>
                            <div
                                className="w-16 h-16 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: style.primaryColor }}
                            >
                                <QrCode size={32} style={{ color: style.accentColor }} />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary w-full"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
