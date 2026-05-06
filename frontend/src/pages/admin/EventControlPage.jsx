import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Users, UserCog, QrCode, BarChart3, Palette,
    Search, Check, X, RotateCcw, LogIn, LogOut,
    Clock, UserCheck, UserX, RefreshCw, MessageSquare, Trash2, PlusCircle,
    Mic, Ticket, Bell, Award, Send, XCircle
} from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Dock from '../../components/Dock';
import TeamManagement from '../../components/TeamManagement';


const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'checkin', label: 'Check-in', icon: QrCode },
    { id: 'attendees', label: 'Attendees', icon: Users },
    { id: 'team', label: 'Team', icon: UserCog },
    { id: 'tiers', label: 'Ticket Tiers', icon: Ticket },
    { id: 'speakers', label: 'Speakers', icon: Mic },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'polls', label: 'Polls', icon: MessageSquare },
    { id: 'style', label: 'Ticket Style', icon: Palette },
    { id: 'certificates', label: 'Certificates', icon: Award }
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

            {/* Floating Dock Navigation */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <Dock
                    items={TABS.map(tab => ({
                        icon: <tab.icon size={22} />,
                        label: tab.label,
                        active: activeTab === tab.id,
                        onClick: () => setActiveTab(tab.id)
                    }))}
                    magnification={65}
                    baseItemSize={48}
                    distance={120}
                />
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <OverviewTab stats={stats} />
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

            {activeTab === 'polls' && (
                <PollsTab eventId={eventId} />
            )}

            {activeTab === 'team' && (
                <TeamManagement eventId={eventId} />
            )}

            {activeTab === 'tiers' && (
                <TiersTab eventId={eventId} />
            )}

            {activeTab === 'speakers' && (
                <SpeakersTab eventId={eventId} />
            )}

            {activeTab === 'reminders' && (
                <RemindersTab eventId={eventId} />
            )}

            {activeTab === 'style' && (
                <TicketStyleTab eventId={eventId} currentStyle={event?.ticketStyle} />
            )}

            {activeTab === 'certificates' && (
                <CertificatesTab eventId={eventId} event={event} />
            )}
        </div>
    );
}

// Overview Tab Component
function OverviewTab({ stats }) {
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
        <div className={`card p-4 ${colors[color]}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon size={18} className="opacity-60" />
                <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            {subtext && <p className="text-xs opacity-60 mt-0.5">{subtext}</p>}
        </div>
    );
}

// Check-in Tab Component
function CheckinTab({ attendees, searchTerm, setSearchTerm, statusFilter, setStatusFilter, onCheckIn, onCheckOut, onReset, stats }) {
    return (
        <div className="space-y-3">
            {/* Quick Stats + Search in one row */}
            <div className="flex items-center gap-3 flex-wrap">
                {stats && (
                    <>
                        <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-sm">
                            <span className="font-bold">{stats.checkedIn}</span> checked in
                        </div>
                        <div className="bg-orange-500/10 text-orange-400 px-3 py-1.5 rounded-lg text-sm">
                            <span className="font-bold">{stats.notCheckedIn}</span> pending
                        </div>
                        <div className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg text-sm">
                            <span className="font-bold">{stats.currentlyInside}</span> inside
                        </div>
                    </>
                )}
                <div className="flex-1 min-w-[200px] relative ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input pl-9 py-1.5 text-sm"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="input w-auto py-1.5 text-sm"
                >
                    <option value="all">All</option>
                    <option value="not-checked-in">Not Checked In</option>
                    <option value="checked-in">Checked In</option>
                    <option value="checked-out">Checked Out</option>
                </select>
            </div>

            {/* Attendee List */}
            <div className="space-y-1.5">
                {attendees.length === 0 ? (
                    <p className="text-gray-400 text-center py-6">No attendees found</p>
                ) : (
                    attendees.map(attendee => (
                        <div key={attendee.id} className="card flex items-center justify-between px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-white text-sm">{attendee.name}</p>
                                    <span className="text-[10px] font-mono bg-white/10 text-gray-400 px-1.5 py-0.5 rounded">
                                        {attendee.ticketShortId || attendee.ticketId?.substring(0, 8).toUpperCase()}
                                    </span>
                                    {attendee.bookedAt && (
                                        <span className="text-[11px] text-gray-500 ml-1">
                                            <Clock size={10} className="inline mr-0.5" />
                                            {format(new Date(attendee.bookedAt), 'MMM d, h:mm a')}
                                        </span>
                                    )}
                                    {attendee.checkedInAt && (
                                        <span className="text-[11px] text-emerald-400 ml-1">
                                            <Check size={10} className="inline mr-0.5" />
                                            {format(new Date(attendee.checkedInAt), 'MMM d, h:mm a')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400">{attendee.email}</p>
                            </div>
                            <div className="flex gap-1.5 items-center">
                                {!attendee.checkedInAt ? (
                                    <button
                                        onClick={() => onCheckIn(attendee.ticketId)}
                                        className="btn btn-primary px-3 py-1.5 text-sm"
                                    >
                                        <LogIn size={14} />
                                        Check In
                                    </button>
                                ) : !attendee.checkedOutAt ? (
                                    <button
                                        onClick={() => onCheckOut(attendee.ticketId)}
                                        className="btn btn-secondary px-3 py-1.5 text-sm"
                                    >
                                        <LogOut size={14} />
                                        Check Out
                                    </button>
                                ) : (
                                    <span className="badge badge-neutral text-xs">Done</span>
                                )}
                                {attendee.checkedInAt && (
                                    <button
                                        onClick={() => onReset(attendee.ticketId)}
                                        className="btn btn-ghost px-1.5"
                                        title="Reset"
                                    >
                                        <RotateCcw size={14} />
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
        <div className="space-y-3">
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
                            <th className="px-4 py-2 text-xs font-medium text-gray-400">Name</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-400">Email</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-400">Status</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-400">Check-in Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendees.map(a => (
                            <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="px-4 py-2 text-white text-sm">{a.name}</td>
                                <td className="px-4 py-2 text-gray-400 text-sm">{a.email}</td>
                                <td className="px-4 py-2">
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
                                <td className="px-4 py-2 text-gray-400 text-sm">
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

// Ticket Style Tab Component - Enhanced Wix-like Builder
function TicketStyleTab({ eventId, currentStyle }) {
    const [style, setStyle] = useState(currentStyle || {
        template: 'modern',
        primaryColor: '#E23744',
        accentColor: '#ffffff',
        backgroundColor: '#18181b',
        headerImage: '',
        fontFamily: 'Helvetica',
        borderRadius: '16',
        showQR: true,
        showLogo: true,
        showBorder: true
    });
    const [saving, setSaving] = useState(false);

    // PDF-compatible fonts only
    const FONTS = [
        { id: 'Helvetica', label: 'Helvetica (Sans)' },
        { id: 'Times-Roman', label: 'Times (Serif)' },
        { id: 'Courier', label: 'Courier (Mono)' }
    ];
    const TEMPLATES = [
        { id: 'modern', label: 'Modern', desc: 'Clean gradient design' },
        { id: 'minimal', label: 'Minimal', desc: 'Simple & elegant' },
        { id: 'classic', label: 'Classic', desc: 'Traditional look' },
        { id: 'bold', label: 'Bold', desc: 'Eye-catching colors' }
    ];

    const previewTheme = {
        modern: {
            cardBg: 'rgb(25, 25, 35)',
            wrapperBg: style.backgroundColor,
            headerBg: `linear-gradient(135deg, ${style.primaryColor} 0%, rgba(0,0,0,0.55) 100%)`,
            accentGlow: `0 0 0 1px ${style.primaryColor}33, 0 20px 45px rgba(0,0,0,0.35)`
        },
        minimal: {
            cardBg: 'rgb(17, 24, 39)',
            wrapperBg: '#0f172a',
            headerBg: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0))',
            accentGlow: '0 0 0 1px rgba(255,255,255,0.08), 0 10px 30px rgba(0,0,0,0.25)'
        },
        classic: {
            cardBg: 'rgb(38, 30, 22)',
            wrapperBg: 'rgb(28, 23, 18)',
            headerBg: `linear-gradient(135deg, ${style.primaryColor} 0%, rgba(20,10,0,0.65) 100%)`,
            accentGlow: `0 0 0 1px ${style.primaryColor}55, inset 0 0 0 1px rgba(245,222,179,0.12)`
        },
        bold: {
            cardBg: 'rgb(30, 16, 28)',
            wrapperBg: style.backgroundColor,
            headerBg: `linear-gradient(135deg, ${style.primaryColor} 0%, #111827 100%)`,
            accentGlow: `0 0 0 1px ${style.primaryColor}66, 0 24px 50px rgba(0,0,0,0.45)`
        }
    };

    const selectedPreview = previewTheme[style.template] || previewTheme.modern;

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
            {/* Settings Panel */}
            <div className="space-y-6">
                <div className="card p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Palette size={20} className="text-[#E23744]" />
                        Customize Ticket Design
                    </h3>

                    {/* Template Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-3">Template Style</label>
                        <div className="grid grid-cols-2 gap-3">
                            {TEMPLATES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setStyle({ ...style, template: t.id })}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${style.template === t.id
                                        ? 'border-[#E23744] bg-[#E23744]/10'
                                        : 'border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <p className="font-medium text-white">{t.label}</p>
                                    <p className="text-xs text-gray-500">{t.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-400">Colors</label>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Primary</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={style.primaryColor}
                                        onChange={e => setStyle({ ...style, primaryColor: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <input
                                        type="text"
                                        value={style.primaryColor}
                                        onChange={e => setStyle({ ...style, primaryColor: e.target.value })}
                                        className="input text-xs flex-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Accent</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={style.accentColor}
                                        onChange={e => setStyle({ ...style, accentColor: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <input
                                        type="text"
                                        value={style.accentColor}
                                        onChange={e => setStyle({ ...style, accentColor: e.target.value })}
                                        className="input text-xs flex-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Background</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={style.backgroundColor}
                                        onChange={e => setStyle({ ...style, backgroundColor: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <input
                                        type="text"
                                        value={style.backgroundColor}
                                        onChange={e => setStyle({ ...style, backgroundColor: e.target.value })}
                                        className="input text-xs flex-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Font & Border Radius */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Font</label>
                            <select
                                value={style.fontFamily}
                                onChange={e => setStyle({ ...style, fontFamily: e.target.value })}
                                className="input w-full"
                            >
                                {FONTS.map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Corners</label>
                            <input
                                type="range"
                                min="0"
                                max="32"
                                value={style.borderRadius}
                                onChange={e => setStyle({ ...style, borderRadius: e.target.value })}
                                className="w-full accent-[#E23744]"
                            />
                            <p className="text-xs text-gray-500 mt-1">{style.borderRadius}px</p>
                        </div>
                    </div>

                    {/* Header Image */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Header Background Image (URL)</label>
                        <input
                            type="url"
                            value={style.headerImage || ''}
                            onChange={e => setStyle({ ...style, headerImage: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            className="input w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">Optional: Use an image instead of solid color for header</p>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Elements</label>
                        {[
                            { key: 'showQR', label: 'Show QR Code' },
                            { key: 'showLogo', label: 'Show Event Logo' },
                            { key: 'showBorder', label: 'Show Border' }
                        ].map(toggle => (
                            <label key={toggle.key} className="flex items-center gap-3 cursor-pointer group">
                                <div
                                    className={`w-11 h-6 rounded-full transition-colors relative ${style[toggle.key] ? 'bg-[#E23744]' : 'bg-white/20'
                                        }`}
                                    onClick={() => setStyle({ ...style, [toggle.key]: !style[toggle.key] })}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${style[toggle.key] ? 'left-6' : 'left-1'
                                        }`} />
                                </div>
                                <span className="text-sm text-gray-300 group-hover:text-white">{toggle.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary w-full"
                >
                    {saving ? 'Saving...' : 'Save Ticket Design'}
                </button>
            </div>

            {/* Live Preview - Matches PDF design */}
            <div className="lg:sticky lg:top-6">
                <label className="block text-sm font-medium text-gray-400 mb-3">Live Preview</label>
                <div
                    className="overflow-hidden transition-all p-2"
                    style={{
                        backgroundColor: selectedPreview.wrapperBg,
                        borderRadius: `${style.borderRadius}px`,
                        boxShadow: selectedPreview.accentGlow,
                        fontFamily: style.fontFamily === 'Times-Roman' ? 'Times New Roman, serif' :
                            style.fontFamily === 'Courier' ? 'Courier New, monospace' : 'Helvetica, Arial, sans-serif'
                    }}
                >
                    {/* Inner card with optional border */}
                    <div
                        className="m-3 rounded-lg overflow-hidden"
                        style={{
                            backgroundColor: selectedPreview.cardBg,
                            border: style.showBorder ? `2px solid ${style.primaryColor}` : 'none',
                            borderRadius: `${Math.max(0, parseInt(style.borderRadius) - 4)}px`
                        }}
                    >
                        {/* Header Section */}
                        <div
                            className="h-24 flex items-end p-4"
                            style={{
                                background: style.headerImage
                                    ? `linear-gradient(to top, rgba(0,0,0,0.7), transparent), url(${style.headerImage}) center/cover`
                                    : selectedPreview.headerBg
                            }}
                        >
                            <div>
                                {style.showLogo && (
                                    <p className="text-xs font-bold mb-1" style={{ color: style.primaryColor }}>
                                        ✦ EVENT TICKET
                                    </p>
                                )}
                                <h4 className="text-lg font-bold" style={{ color: style.accentColor }}>
                                    Tech Summit 2026
                                </h4>
                                {style.template === 'bold' && (
                                    <p className="text-[10px] mt-1 font-semibold tracking-wide" style={{ color: style.primaryColor }}>
                                        VIP ACCESS
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="p-4">
                            <div className={`flex gap-4 ${style.showQR ? '' : 'flex-col'}`}>
                                {/* QR Code */}
                                {style.showQR && (
                                    <div className="flex flex-col items-center">
                                        <div
                                            className="w-16 h-16 rounded-lg flex items-center justify-center"
                                            style={{
                                                backgroundColor: 'rgb(30, 30, 40)',
                                                border: `1.5px solid ${style.primaryColor}`
                                            }}
                                        >
                                            <QrCode size={40} className="text-white" />
                                        </div>
                                        <p className="text-[8px] text-gray-500 mt-1">SCAN TO ENTER</p>
                                    </div>
                                )}

                                {/* Event Details */}
                                <div className="flex-1 space-y-2 text-xs">
                                    <div>
                                        <p className="text-gray-500 text-[10px]">DATE & TIME</p>
                                        <p className="font-bold" style={{ color: style.accentColor }}>Jan 15, 2026</p>
                                        <p className="text-gray-400">10:00 AM</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-[10px]">VENUE</p>
                                        <p className="font-bold" style={{ color: style.accentColor }}>Convention Center</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-[10px]">TICKET #</p>
                                        <p className="font-mono font-bold" style={{ color: style.primaryColor }}>A1B2C3D4</p>
                                    </div>
                                </div>
                            </div>

                            {/* Perforated Line */}
                            <div className="my-4 border-t border-dashed border-gray-600 relative">
                                <div className="absolute -left-7 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full" style={{ backgroundColor: style.backgroundColor }}></div>
                                <div className="absolute -right-7 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full" style={{ backgroundColor: style.backgroundColor }}></div>
                            </div>

                            {/* Attendee Section */}
                            <div>
                                <p className="text-[10px] font-bold mb-2" style={{ color: style.primaryColor }}>ATTENDEE INFORMATION</p>
                                <div className="flex justify-between text-xs">
                                    <div>
                                        <p className="text-gray-500 text-[10px]">NAME</p>
                                        <p className="font-bold" style={{ color: style.accentColor }}>John Doe</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-[10px]">EMAIL</p>
                                        <p className="text-gray-400">john@example.com</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-700 p-3 text-center">
                            <p className="text-[8px] text-gray-500">Non-transferable • Valid for single entry</p>
                            {style.showLogo && (
                                <p className="font-bold mt-2" style={{ color: style.primaryColor }}>occasio</p>
                            )}
                        </div>
                    </div>
                    <p className="text-[11px] text-gray-500 px-4 pb-3">
                        Template: <span className="text-gray-300 font-medium capitalize">{style.template}</span> • Preview updates exactly as you edit colors, corners, font, and elements.
                    </p>
                </div>
            </div>
        </div>
    );
}

// Polls Tab Component
function PollsTab({ eventId }) {
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Form state
    const [newPoll, setNewPoll] = useState({
        question: '',
        description: '',
        allowMultiple: false,
        notifyUsers: true,
        options: [{ text: '' }, { text: '' }]
    });

    useEffect(() => {
        fetchPolls();
    }, [eventId]);

    const fetchPolls = async () => {
        try {
            const res = await api.get(`/admin/events/${eventId}/polls`);
            setPolls(res.data);
        } catch (error) {
            console.error('Failed to fetch polls');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOption = () => {
        setNewPoll({
            ...newPoll,
            options: [...newPoll.options, { text: '' }]
        });
    };

    const handleRemoveOption = (idx) => {
        const updated = newPoll.options.filter((_, i) => i !== idx);
        setNewPoll({ ...newPoll, options: updated });
    };

    const handleOptionChange = (idx, val) => {
        const updated = [...newPoll.options];
        updated[idx].text = val;
        setNewPoll({ ...newPoll, options: updated });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!newPoll.question.trim()) return toast.error('Question is required');
        const validOptions = newPoll.options.filter(o => o.text.trim());
        if (validOptions.length < 2) return toast.error('At least 2 options required');

        try {
            await api.post(`/admin/events/${eventId}/polls`, {
                ...newPoll,
                options: validOptions
            });
            toast.success('Poll created successfully');
            setShowCreate(false);
            setNewPoll({
                question: '',
                description: '',
                allowMultiple: false,
                notifyUsers: true,
                options: [{ text: '' }, { text: '' }]
            });
            fetchPolls();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create poll');
        }
    };

    const handleDelete = async (pollId) => {
        if (!confirm('Are you sure you want to delete this poll?')) return;
        try {
            await api.delete(`/admin/polls/${pollId}`);
            toast.success('Poll deleted');
            fetchPolls();
        } catch (error) {
            toast.error('Failed to delete poll');
        }
    };

    const toggleActive = async (poll, currentStatus) => {
        try {
            await api.put(`/admin/polls/${poll.id}`, { isActive: !currentStatus });
            toast.success('Poll updated');
            fetchPolls();
        } catch (error) {
            toast.error('Failed to update poll');
        }
    };

    if (loading) {
        return <div className="text-gray-400">Loading polls...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Event Polls</h3>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="btn btn-primary"
                >
                    {showCreate ? 'Cancel' : 'Create Poll'}
                </button>
            </div>

            {showCreate && (
                <div className="card p-6 animate-fade-in border-l-4 border-l-[#E23744]">
                    <h4 className="text-lg font-bold mb-4">Create New Poll</h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Question</label>
                            <input
                                type="text"
                                value={newPoll.question}
                                onChange={e => setNewPoll({ ...newPoll, question: e.target.value })}
                                placeholder="What would you like to ask?"
                                className="input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Description (Optional)</label>
                            <textarea
                                value={newPoll.description}
                                onChange={e => setNewPoll({ ...newPoll, description: e.target.value })}
                                placeholder="Add some context..."
                                className="input min-h-[80px]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Options</label>
                            <div className="space-y-2">
                                {newPoll.options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={opt.text}
                                            onChange={e => handleOptionChange(idx, e.target.value)}
                                            placeholder={`Option ${idx + 1}`}
                                            className="input"
                                        />
                                        {newPoll.options.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOption(idx)}
                                                className="btn btn-secondary px-3"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleCreateOption}
                                    className="text-sm text-[#E23744] hover:text-white flex items-center gap-1 mt-2"
                                >
                                    <PlusCircle size={14} /> Add Option
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-6 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newPoll.allowMultiple}
                                    onChange={e => setNewPoll({ ...newPoll, allowMultiple: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-600 text-[#E23744] focus:ring-[#E23744]"
                                />
                                <span className="text-sm text-gray-300">Allow multiple answers</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newPoll.notifyUsers}
                                    onChange={e => setNewPoll({ ...newPoll, notifyUsers: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-600 text-[#E23744] focus:ring-[#E23744]"
                                />
                                <span className="text-sm text-gray-300">Notify attendees via email</span>
                            </label>
                        </div>

                        <div className="pt-2">
                            <button type="submit" className="btn btn-primary w-full">Launch Poll</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid gap-4">
                {polls.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <MessageSquare size={40} className="mx-auto mb-2 opacity-20" />
                        <p>No polls yet</p>
                    </div>
                ) : (
                    polls.map(poll => (
                        <div key={poll.id} className="card p-5 group">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h5 className="font-bold text-lg text-white">{poll.question}</h5>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                        <span>{format(new Date(poll.createdAt), 'MMM d, yyyy')}</span>
                                        <span>•</span>
                                        <span className={poll.isActive ? 'text-green-500' : 'text-orange-500'}>
                                            {poll.isActive ? 'Active' : 'Ended'}
                                        </span>
                                        <span>•</span>
                                        <span>{poll.options.reduce((acc, o) => acc + (o._count?.votes || 0), 0)} votes</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => toggleActive(poll, poll.isActive)}
                                        className="btn btn-secondary px-3 py-1 text-xs"
                                    >
                                        {poll.isActive ? 'Close' : 'Reopen'}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(poll.id)}
                                        className="btn btn-ghost px-3 py-1 text-xs hover:bg-red-500/10 hover:text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                {poll.options.map(opt => {
                                    const totalVotes = poll.options.reduce((acc, o) => acc + (o._count?.votes || 0), 0);
                                    const percentage = totalVotes > 0 ? ((opt._count?.votes || 0) / totalVotes * 100).toFixed(1) : 0;

                                    return (
                                        <div key={opt.id} className="relative h-8 bg-white/5 rounded-md overflow-hidden">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-white/10"
                                                style={{ width: `${percentage}%` }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-between px-3 text-xs">
                                                <span>{opt.text}</span>
                                                <span>{opt._count?.votes || 0} ({percentage}%)</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ============================================
// TIERS TAB
// ============================================
function TiersTab({ eventId }) {
    const [tiers, setTiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTier, setEditingTier] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', priceCents: 0, capacity: '' });

    useEffect(() => {
        fetchTiers();
    }, [eventId]);

    const fetchTiers = async () => {
        try {
            const res = await api.get(`/events/${eventId}/tiers`);
            setTiers(res.data);
        } catch (error) {
            console.error('Error fetching tiers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTier) {
                await api.put(`/admin/tiers/${editingTier.id}`, form);
                toast.success('Tier updated');
            } else {
                await api.post(`/admin/events/${eventId}/tiers`, form);
                toast.success('Tier created');
            }
            setShowForm(false);
            setEditingTier(null);
            setForm({ name: '', description: '', priceCents: 0, capacity: '' });
            fetchTiers();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save tier');
        }
    };

    const handleDelete = async (tierId) => {
        if (!confirm('Delete this tier?')) return;
        try {
            await api.delete(`/admin/tiers/${tierId}`);
            toast.success('Tier deleted');
            fetchTiers();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Ticket Tiers</h2>
                <button onClick={() => { setShowForm(true); setEditingTier(null); setForm({ name: '', description: '', priceCents: 0, capacity: '' }); }} className="btn btn-primary">
                    <PlusCircle size={18} /> Add Tier
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-6 p-4 bg-white/5 rounded-lg space-y-4">
                    <input type="text" placeholder="Tier Name (e.g., VIP, Standard)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
                    <input type="text" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" placeholder="Price (in paise)" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: parseInt(e.target.value) || 0 })} className="input" required />
                        <input type="number" placeholder="Capacity (leave empty for unlimited)" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="input" />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary">{editingTier ? 'Update' : 'Create'}</button>
                        <button type="button" onClick={() => { setShowForm(false); setEditingTier(null); }} className="btn btn-ghost">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-gray-400">Loading...</div>
            ) : tiers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Ticket className="mx-auto mb-4 opacity-50" size={48} />
                    <p>No tiers created yet</p>
                    <p className="text-sm">Add different ticket types like VIP, Standard, Early Bird</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tiers.map(tier => (
                        <div key={tier.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                            <div>
                                <h3 className="font-semibold text-white">{tier.name}</h3>
                                <p className="text-sm text-gray-400">{tier.description || 'No description'}</p>
                                <p className="text-sm text-green-400">₹{(tier.priceCents / 100).toFixed(2)} • {tier.capacity ? `${tier.soldCount}/${tier.capacity} sold` : 'Unlimited'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingTier(tier); setForm({ name: tier.name, description: tier.description || '', priceCents: tier.priceCents, capacity: tier.capacity || '' }); setShowForm(true); }} className="btn btn-ghost btn-sm">Edit</button>
                                <button onClick={() => handleDelete(tier.id)} className="btn btn-ghost btn-sm text-red-400"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// SPEAKERS TAB
// ============================================
function SpeakersTab({ eventId }) {
    const [speakers, setSpeakers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSpeaker, setEditingSpeaker] = useState(null);
    const [form, setForm] = useState({ name: '', title: '', bio: '', photoUrl: '', linkedIn: '', twitter: '' });

    useEffect(() => {
        fetchSpeakers();
    }, [eventId]);

    const fetchSpeakers = async () => {
        try {
            const res = await api.get(`/events/${eventId}/speakers`);
            setSpeakers(res.data);
        } catch (error) {
            console.error('Error fetching speakers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSpeaker) {
                await api.put(`/admin/speakers/${editingSpeaker.id}`, form);
                toast.success('Speaker updated');
            } else {
                await api.post(`/admin/events/${eventId}/speakers`, form);
                toast.success('Speaker added');
            }
            setShowForm(false);
            setEditingSpeaker(null);
            setForm({ name: '', title: '', bio: '', photoUrl: '', linkedIn: '', twitter: '' });
            fetchSpeakers();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save speaker');
        }
    };

    const handleDelete = async (speakerId) => {
        if (!confirm('Remove this speaker?')) return;
        try {
            await api.delete(`/admin/speakers/${speakerId}`);
            toast.success('Speaker removed');
            fetchSpeakers();
        } catch (error) {
            toast.error('Failed to remove');
        }
    };

    return (
        <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Speakers</h2>
                <button onClick={() => { setShowForm(true); setEditingSpeaker(null); setForm({ name: '', title: '', bio: '', photoUrl: '', linkedIn: '', twitter: '' }); }} className="btn btn-primary">
                    <PlusCircle size={18} /> Add Speaker
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-6 p-4 bg-white/5 rounded-lg space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Speaker Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
                        <input type="text" placeholder="Title (e.g., CEO at Company)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
                    </div>
                    <textarea placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="input w-full h-24" />
                    <input type="url" placeholder="Photo URL" value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} className="input w-full" />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="url" placeholder="LinkedIn URL" value={form.linkedIn} onChange={(e) => setForm({ ...form, linkedIn: e.target.value })} className="input" />
                        <input type="text" placeholder="Twitter handle" value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} className="input" />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary">{editingSpeaker ? 'Update' : 'Add'}</button>
                        <button type="button" onClick={() => { setShowForm(false); setEditingSpeaker(null); }} className="btn btn-ghost">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-gray-400">Loading...</div>
            ) : speakers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Mic className="mx-auto mb-4 opacity-50" size={48} />
                    <p>No speakers added yet</p>
                    <p className="text-sm">Add speakers to showcase on the event page</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {speakers.map(speaker => (
                        <div key={speaker.id} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                            {speaker.photoUrl ? (
                                <img src={speaker.photoUrl} alt={speaker.name} className="w-16 h-16 rounded-full object-cover" />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold">{speaker.name.charAt(0)}</div>
                            )}
                            <div className="flex-1">
                                <h3 className="font-semibold text-white">{speaker.name}</h3>
                                {speaker.title && <p className="text-sm text-gray-400">{speaker.title}</p>}
                                {speaker.bio && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{speaker.bio}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingSpeaker(speaker); setForm({ name: speaker.name, title: speaker.title || '', bio: speaker.bio || '', photoUrl: speaker.photoUrl || '', linkedIn: speaker.linkedIn || '', twitter: speaker.twitter || '' }); setShowForm(true); }} className="btn btn-ghost btn-sm">Edit</button>
                                <button onClick={() => handleDelete(speaker.id)} className="btn btn-ghost btn-sm text-red-400"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// REMINDERS TAB
// ============================================
function RemindersTab({ eventId }) {
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ hoursBeforeEvent: 24, subject: '', message: '' });

    useEffect(() => {
        fetchReminders();
    }, [eventId]);

    const fetchReminders = async () => {
        try {
            const res = await api.get(`/admin/events/${eventId}/reminders`);
            setReminders(res.data);
        } catch (error) {
            console.error('Error fetching reminders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/admin/events/${eventId}/reminders`, form);
            toast.success('Reminder created');
            setShowForm(false);
            setForm({ hoursBeforeEvent: 24, subject: '', message: '' });
            fetchReminders();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create reminder');
        }
    };

    const handleDelete = async (reminderId) => {
        if (!confirm('Delete this reminder?')) return;
        try {
            await api.delete(`/admin/reminders/${reminderId}`);
            toast.success('Reminder deleted');
            fetchReminders();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const toggleActive = async (reminder) => {
        try {
            await api.put(`/admin/reminders/${reminder.id}`, { isActive: !reminder.isActive });
            fetchReminders();
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    return (
        <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">Event Reminders</h2>
                    <p className="text-sm text-gray-400">Automated emails sent to attendees before the event</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">
                    <PlusCircle size={18} /> Add Reminder
                </button>
            </div>

            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
                <strong>Tip:</strong> Use placeholders: {'{name}'}, {'{event}'}, {'{date}'}, {'{time}'}, {'{location}'}
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-6 p-4 bg-white/5 rounded-lg space-y-4">
                    <select value={form.hoursBeforeEvent} onChange={(e) => setForm({ ...form, hoursBeforeEvent: parseInt(e.target.value) })} className="input w-full">
                        <option value={168}>1 week before</option>
                        <option value={72}>3 days before</option>
                        <option value={24}>1 day before</option>
                        <option value={12}>12 hours before</option>
                        <option value={2}>2 hours before</option>
                        <option value={1}>1 hour before</option>
                    </select>
                    <input type="text" placeholder="Email Subject (e.g., Don't forget: {event} is tomorrow!)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input w-full" required />
                    <textarea placeholder="Email Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input w-full h-32" required />
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary">Create Reminder</button>
                        <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-gray-400">Loading...</div>
            ) : reminders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Bell className="mx-auto mb-4 opacity-50" size={48} />
                    <p>No reminders configured</p>
                    <p className="text-sm">Set up automatic reminder emails for attendees</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reminders.map(reminder => (
                        <div key={reminder.id} className={`flex items-center justify-between p-4 rounded-lg ${reminder.isActive ? 'bg-white/5' : 'bg-white/2 opacity-50'}`}>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-white">{reminder.hoursBeforeEvent}h before</h3>
                                    {reminder.sentAt && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Sent</span>}
                                </div>
                                <p className="text-sm text-gray-400">{reminder.subject}</p>
                            </div>
                            <div className="flex gap-2 items-center">
                                <button onClick={() => toggleActive(reminder)} className={`btn btn-ghost btn-sm ${reminder.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                                    {reminder.isActive ? 'Active' : 'Paused'}
                                </button>
                                <button onClick={() => handleDelete(reminder.id)} className="btn btn-ghost btn-sm text-red-400"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CertificatesTab({ eventId, event }) {
    const [sending, setSending] = useState(false);
    const [dryRunLoading, setDryRunLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [sendResult, setSendResult] = useState(null);
    const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const loadPreview = () => {
        const configs = event?.certificateConfigs || {};
        const hasTemplate = configs?.participation?.templateUrl || event?.certificateTemplateUrl;
        if (!hasTemplate) return;

        setPreviewError(null);
        setPreviewLoading(true);
        let blobUrl = null;
        api.get(`/admin/events/${eventId}/certificates/template?type=participation`, { responseType: 'blob' })
            .then(res => {
                blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                setPreviewBlobUrl(blobUrl);
            })
            .catch(err => {
                console.error('Failed to load certificate preview:', err);
                const msg = err.response?.data?.error
                    || (err.response?.status === 401 ? 'Template authentication failed — try re-uploading the certificate template'
                    : 'Could not load certificate preview');
                setPreviewError(msg);
            })
            .finally(() => setPreviewLoading(false));

        return blobUrl;
    };

    // Load preview via authenticated API call (iframe can't pass auth headers)
    useEffect(() => {
        const blobUrl = loadPreview();
        return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    }, [eventId, event?.certificateTemplateUrl]);

    const handleSend = async (dryRun = false) => {
        if (!confirm(dryRun ? 'Check how many emails will be sent?' : 'Are you sure you want to send certificates to ALL checked-in users?')) return;
        
        try {
            if (dryRun) setDryRunLoading(true);
            else { setSending(true); setSendResult(null); }

            const res = await api.post(`/admin/events/${eventId}/certificates`, { dryRun });
            
            if (dryRun) {
                setStats(res.data);
                toast.success(`Found ${res.data.count} recipients`);
            } else {
                setSendResult(res.data);
                if (res.data.sent > 0) {
                    toast.success(`${res.data.sent} certificate(s) sent successfully`);
                } else {
                    toast.error(res.data.message || 'No certificates were sent');
                }
            }
        } catch (error) {
            const errData = error.response?.data;
            toast.error(errData?.error || 'Failed to send certificates');
            if (errData) setSendResult(errData);
        } finally {
            if (dryRun) setDryRunLoading(false);
            else setSending(false);
        }
    };

    // Check if any certificate is configured (new configs or legacy)
    const configs = event.certificateConfigs || {};
    const hasAnyConfig = event.certificateEnabled || 
        event.certificateTemplateUrl || 
        Object.values(configs).some(c => c?.templateUrl);

    if (!hasAnyConfig) {
      return (
        <div className="glass-card p-8 text-center">
            <Award className="mx-auto mb-3 text-gray-500" size={48} />
            <h3 className="text-lg font-bold text-white mb-1.5">Certificates Not Configured</h3>
            <p className="text-gray-400 mb-4 max-w-md mx-auto text-sm">
                Upload a template and map fields on the Edit Event page.
            </p>
            <Link to={`/admin/events/${eventId}/edit`} className="btn btn-primary">
                Configure Certificate
            </Link>
        </div>
      );
    }

    // Get the best template URL for preview — always use the backend proxy
    // (Cloudinary raw file URLs return 401 without signed access)
    const hasTemplate = configs?.participation?.templateUrl || event.certificateTemplateUrl;

    return (
        <div className="space-y-4">
            <div className="glass-card p-5">
                <h2 className="text-lg font-bold text-white mb-3">Certificate Dashboard</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                    <div className="md:col-span-3">
                        <h3 className="text-xs font-semibold text-gray-400 mb-1.5 uppercase">Preview</h3>
                        <div className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700" style={{ height: '360px' }}>
                             {previewBlobUrl ? (
                                <iframe 
                                    src={previewBlobUrl} 
                                    className="w-full h-full"
                                    title="Certificate Preview"
                                />
                             ) : previewError ? (
                                <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
                                    <XCircle className="text-red-400" size={36} />
                                    <p className="text-red-300 text-sm">{previewError}</p>
                                    <button onClick={loadPreview} className="text-xs text-blue-400 hover:text-blue-300 underline">
                                        Retry
                                    </button>
                                </div>
                             ) : previewLoading || hasTemplate ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-400 border-r-2 border-blue-400/30"></div>
                                    <span className="text-sm">Loading preview...</span>
                                </div>
                             ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">No Preview</div>
                             )}
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col justify-center gap-3">
                        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                            <h4 className="font-semibold text-white mb-1.5 text-sm">Ready to Send</h4>
                            <p className="text-gray-400 text-xs mb-3">
                                Certificates will be generated and emailed to all attendees who have checked in.
                            </p>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => handleSend(true)}
                                    disabled={dryRunLoading || sending}
                                    className="btn btn-ghost border border-gray-600 text-sm px-3 py-1.5"
                                >
                                    {dryRunLoading ? 'Checking...' : 'Check Count'}
                                </button>
                                
                                <button 
                                    onClick={() => handleSend(false)}
                                    disabled={sending}
                                    className="btn btn-primary flex-1 text-sm px-3 py-1.5"
                                >
                                    <Send size={16} className={sending ? 'animate-spin' : ''} />
                                    {sending ? 'Sending...' : 'Send Certificates'}
                                </button>
                            </div>
                        </div>

                        {stats && (
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <p className="text-blue-300">
                                    <strong>Dry Run Result:</strong> {stats.count} certificates will be sent.
                                </p>
                            </div>
                        )}

                        {sendResult && (
                            <div className={`p-4 rounded-lg border ${sendResult.sent > 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                <p className={sendResult.sent > 0 ? 'text-green-300' : 'text-red-300'}>
                                    <strong>Send Result:</strong> {sendResult.sent || 0} sent, {sendResult.failed || 0} failed
                                    {sendResult.total ? ` out of ${sendResult.total} total` : ''}
                                </p>
                                {sendResult.errors && sendResult.errors.length > 0 && (
                                    <div className="mt-2 text-sm text-red-400 max-h-32 overflow-y-auto">
                                        {sendResult.errors.map((e, i) => (
                                            <div key={i} className="truncate">{e.email}: {e.error || e.reason || 'Unknown error'}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
