import { useState, useEffect } from 'react';
import PollCard from './PollCard';
import api from '../utils/api';
import { BarChart2 } from 'lucide-react';

export default function PollsSection({ eventId }) {
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPolls();
    }, [eventId]);

    const fetchPolls = async () => {
        try {
            const res = await api.get(`/events/${eventId}/polls`);
            setPolls(res.data);
        } catch (error) {
            console.error('Failed to fetch polls');
        } finally {
            setLoading(false);
        }
    };

    if (loading || polls.length === 0) return null;

    return (
        <div className="card space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#E23744]/10 flex items-center justify-center text-[#E23744]">
                    <BarChart2 size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Live Polls</h2>
                    <p className="text-sm text-gray-400">Cast your vote!</p>
                </div>
            </div>

            <div className="grid gap-4">
                {polls.map(poll => (
                    <PollCard key={poll.id} poll={poll} />
                ))}
            </div>
        </div>
    );
}
