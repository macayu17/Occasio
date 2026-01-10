import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getImageUrl } from '../../utils/api';

export default function TeamEventsPage() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTeamEvents();
    }, []);

    const fetchTeamEvents = async () => {
        try {
            setLoading(true);
            const response = await api.get('/team/events');
            setEvents(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load team events');
        } finally {
            setLoading(false);
        }
    };

    const acceptInvitation = async (eventId) => {
        try {
            await api.post(`/team/events/${eventId}/accept`);
            fetchTeamEvents();
        } catch (err) {
            console.error('Failed to accept invitation:', err);
        }
    };

    const getRoleBadge = (role) => {
        const colors = {
            MANAGER: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            SCANNER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            STAFF: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };
        return colors[role] || colors.STAFF;
    };

    const getRoleDescription = (role) => {
        const descriptions = {
            MANAGER: 'Full event access + analytics',
            SCANNER: 'Check-in & attendee list access',
            STAFF: 'View-only access'
        };
        return descriptions[role] || '';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-400">{error}</p>
                <button onClick={fetchTeamEvents} className="mt-4 btn-primary">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Team Events</h1>
                <p className="text-gray-400">
                    Events you've been invited to as a team member
                </p>
            </div>

            {events.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-4">👥</div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Team Events</h3>
                    <p className="text-gray-400">
                        You haven't been invited to any events as a team member yet.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {events.map((event) => (
                        <div key={event.id} className="glass-card overflow-hidden">
                            {/* Event Poster */}
                            {event.posterUrl && (
                                <div className="h-40 bg-gray-800">
                                    <img
                                        src={getImageUrl(event.posterUrl)}
                                        alt={event.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            <div className="p-5">
                                {/* Role Badge */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadge(event.teamRole)}`}>
                                        {event.teamRole}
                                    </span>
                                    {!event.acceptedAt && (
                                        <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                                            Pending
                                        </span>
                                    )}
                                </div>

                                {/* Event Title */}
                                <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                                    {event.title}
                                </h3>

                                {/* Role Description */}
                                <p className="text-sm text-gray-400 mb-3">
                                    {getRoleDescription(event.teamRole)}
                                </p>

                                {/* Event Date */}
                                <div className="flex items-center text-sm text-gray-400 mb-4">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {new Date(event.startTime).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </div>

                                {/* Organizer */}
                                <p className="text-xs text-gray-500 mb-4">
                                    Organized by {event.organizer?.name || 'Unknown'}
                                </p>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    {!event.acceptedAt ? (
                                        <button
                                            onClick={() => acceptInvitation(event.id)}
                                            className="flex-1 btn-primary text-sm py-2"
                                        >
                                            Accept Invitation
                                        </button>
                                    ) : (
                                        <>
                                            {['MANAGER', 'SCANNER'].includes(event.teamRole) && (
                                                <Link
                                                    to={`/admin/team-event/${event.id}/checkin`}
                                                    className="flex-1 btn-primary text-sm py-2 text-center"
                                                >
                                                    Check-In
                                                </Link>
                                            )}
                                            <Link
                                                to={`/admin/team-event/${event.id}`}
                                                className="flex-1 btn-secondary text-sm py-2 text-center"
                                            >
                                                View
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
