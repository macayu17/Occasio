import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Shield, QrCode, Eye, X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const ROLES = [
    { id: 'MANAGER', label: 'Manager', description: 'Full event access', icon: Shield, color: 'text-purple-400' },
    { id: 'SCANNER', label: 'Scanner', description: 'Check-in only', icon: QrCode, color: 'text-blue-400' },
    { id: 'STAFF', label: 'Staff', description: 'View only', icon: Eye, color: 'text-gray-400' }
];

export default function TeamManagement({ eventId }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', name: '', role: 'STAFF' });
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        fetchMembers();
    }, [eventId]);

    const fetchMembers = async () => {
        try {
            const res = await api.get(`/admin/events/${eventId}/team`);
            setMembers(res.data);
        } catch (error) {
            console.error('Failed to fetch team members');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteData.email) return toast.error('Email is required');

        setInviting(true);
        try {
            await api.post(`/admin/events/${eventId}/team`, inviteData);
            toast.success('Team member invited!');
            setShowInvite(false);
            setInviteData({ email: '', name: '', role: 'STAFF' });
            fetchMembers();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to invite');
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (memberId) => {
        if (!confirm('Remove this team member?')) return;
        try {
            await api.delete(`/admin/events/${eventId}/team/${memberId}`);
            toast.success('Member removed');
            fetchMembers();
        } catch (error) {
            toast.error('Failed to remove member');
        }
    };

    const handleRoleChange = async (memberId, newRole) => {
        try {
            await api.put(`/admin/events/${eventId}/team/${memberId}`, { role: newRole });
            toast.success('Role updated');
            fetchMembers();
        } catch (error) {
            toast.error('Failed to update role');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white">Team Members</h3>
                    <p className="text-sm text-gray-400">Manage who can access and manage this event</p>
                </div>
                <button
                    onClick={() => setShowInvite(true)}
                    className="btn btn-primary"
                >
                    <UserPlus size={18} />
                    Invite Member
                </button>
            </div>

            {/* Invite Modal */}
            {showInvite && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-md w-full animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-lg font-bold text-white">Invite Team Member</h4>
                            <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={inviteData.email}
                                    onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                    placeholder="teammate@example.com"
                                    className="input"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Name (optional)</label>
                                <input
                                    type="text"
                                    value={inviteData.name}
                                    onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                    placeholder="John Doe"
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Role</label>
                                <div className="space-y-2">
                                    {ROLES.map(role => (
                                        <label
                                            key={role.id}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${inviteData.role === role.id
                                                    ? 'border-[#E23744] bg-[#E23744]/10'
                                                    : 'border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="role"
                                                value={role.id}
                                                checked={inviteData.role === role.id}
                                                onChange={e => setInviteData({ ...inviteData, role: e.target.value })}
                                                className="hidden"
                                            />
                                            <role.icon size={18} className={role.color} />
                                            <div className="flex-1">
                                                <p className="font-medium text-white">{role.label}</p>
                                                <p className="text-xs text-gray-500">{role.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" disabled={inviting} className="btn btn-primary w-full">
                                {inviting ? 'Inviting...' : 'Send Invite'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Team List */}
            {members.length === 0 ? (
                <div className="card text-center py-12">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="text-gray-500" size={24} />
                    </div>
                    <p className="text-gray-400 mb-2">No team members yet</p>
                    <p className="text-sm text-gray-500">Invite people to help manage this event</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {members.map(member => {
                        const roleInfo = ROLES.find(r => r.id === member.role) || ROLES[2];
                        return (
                            <div key={member.id} className="card p-4 flex items-center gap-4 group">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E23744] to-purple-600 flex items-center justify-center text-white font-bold">
                                    {(member.name || member.email)[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{member.name || member.email}</p>
                                    <p className="text-sm text-gray-400 truncate">{member.email}</p>
                                </div>
                                <select
                                    value={member.role}
                                    onChange={e => handleRoleChange(member.id, e.target.value)}
                                    className="input w-auto text-sm py-1.5 px-3"
                                >
                                    {ROLES.map(role => (
                                        <option key={role.id} value={role.id}>{role.label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleRemove(member.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-2"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
