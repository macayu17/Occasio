import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';

export default function TeamCheckinPage() {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [attendees, setAttendees] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [scanResult, setScanResult] = useState(null);

    useEffect(() => {
        fetchData();
        // Refresh stats every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        fetchAttendees();
    }, [id, filter, search]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchEvent(), fetchStats(), fetchAttendees()]);
        setLoading(false);
    };

    const fetchEvent = async () => {
        try {
            const response = await api.get(`/team/events/${id}`);
            setEvent(response.data);
        } catch (err) {
            console.error('Failed to fetch event:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get(`/team/events/${id}/checkin-stats`);
            setStats(response.data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchAttendees = async () => {
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') params.append('status', filter);
            if (search) params.append('search', search);

            const response = await api.get(`/team/events/${id}/attendees?${params}`);
            setAttendees(response.data);
        } catch (err) {
            console.error('Failed to fetch attendees:', err);
        }
    };

    const handleCheckIn = async (ticketId) => {
        try {
            const response = await api.post(`/team/tickets/${ticketId}/checkin`);
            setScanResult({
                success: true,
                message: `✓ Checked in: ${response.data.attendee?.name || 'Guest'}`
            });
            fetchStats();
            fetchAttendees();
            setTimeout(() => setScanResult(null), 3000);
        } catch (err) {
            setScanResult({
                success: false,
                message: err.response?.data?.error || 'Check-in failed'
            });
            setTimeout(() => setScanResult(null), 3000);
        }
    };

    const handleCheckOut = async (ticketId) => {
        try {
            await api.post(`/team/tickets/${ticketId}/checkout`);
            setScanResult({ success: true, message: '✓ Checked out' });
            fetchStats();
            fetchAttendees();
            setTimeout(() => setScanResult(null), 3000);
        } catch (err) {
            setScanResult({
                success: false,
                message: err.response?.data?.error || 'Check-out failed'
            });
            setTimeout(() => setScanResult(null), 3000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <Link to="/admin/team-events" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
                    ← Back to Team Events
                </Link>
                <h1 className="text-2xl font-bold text-white">{event?.title}</h1>
                <p className="text-gray-400">Check-in Dashboard</p>
            </div>

            {/* Scan Result Toast */}
            {scanResult && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${scanResult.success ? 'bg-green-500' : 'bg-red-500'
                    } text-white font-medium`}>
                    {scanResult.message}
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="glass-card p-4 text-center">
                        <div className="text-3xl font-bold text-white">{stats.total}</div>
                        <div className="text-sm text-gray-400">Total Tickets</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{stats.checkedIn}</div>
                        <div className="text-sm text-gray-400">Checked In</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-400">{stats.notCheckedIn}</div>
                        <div className="text-sm text-gray-400">Not Arrived</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="text-3xl font-bold text-blue-400">{stats.currentlyInside}</div>
                        <div className="text-sm text-gray-400">Currently Inside</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-[200px] px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
                >
                    <option value="all">All</option>
                    <option value="not-checked-in">Not Checked In</option>
                    <option value="checked-in">Checked In</option>
                    <option value="checked-out">Checked Out</option>
                </select>
            </div>

            {/* Attendees List */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-800/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Name</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Email</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {attendees.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-gray-400">
                                        No attendees found
                                    </td>
                                </tr>
                            ) : (
                                attendees.map((attendee) => (
                                    <tr key={attendee.id} className="hover:bg-gray-800/30">
                                        <td className="px-4 py-3 text-white font-medium">{attendee.name}</td>
                                        <td className="px-4 py-3 text-gray-400">{attendee.email}</td>
                                        <td className="px-4 py-3">
                                            {attendee.checkedOutAt ? (
                                                <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">
                                                    Checked Out
                                                </span>
                                            ) : attendee.checkedInAt ? (
                                                <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                                                    Inside
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                                                    Not Arrived
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                {!attendee.checkedInAt && (
                                                    <button
                                                        onClick={() => handleCheckIn(attendee.ticketId)}
                                                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                                                    >
                                                        Check In
                                                    </button>
                                                )}
                                                {attendee.checkedInAt && !attendee.checkedOutAt && (
                                                    <button
                                                        onClick={() => handleCheckOut(attendee.ticketId)}
                                                        className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded"
                                                    >
                                                        Check Out
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
