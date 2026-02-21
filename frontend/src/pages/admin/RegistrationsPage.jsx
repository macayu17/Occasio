import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, CheckCircle, XCircle, Clock, Trash2, LogIn, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function RegistrationsPage() {
  const { id } = useParams();
  const [registrations, setRegistrations] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [eventRes, regRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/admin/events/${id}/registrations`)
      ]);

      setEvent(eventRes.data);
      setRegistrations(regRes.data);
    } catch (error) {
      toast.error('Failed to fetch registrations');
    } finally {
      setLoading(false);
    }
  };

  const deleteRegistration = async (regId, attendeeName) => {
    if (!window.confirm(`Delete registration for "${attendeeName || 'this attendee'}"? This will also delete their ticket.`)) {
      return;
    }

    try {
      await api.delete(`/admin/registrations/${regId}`);
      toast.success('Registration deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete registration');
    }
  };

  const handleCheckIn = async (ticketId, attendeeName) => {
    try {
      await api.post(`/admin/tickets/${ticketId}/checkin`);
      toast.success(`${attendeeName || 'Attendee'} checked in!`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Check-in failed');
    }
  };

  const handleResetCheckin = async (ticketId) => {
    if (!window.confirm('Reset check-in status for this attendee?')) return;
    try {
      await api.post(`/admin/tickets/${ticketId}/reset-checkin`);
      toast.success('Check-in reset');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Reset failed');
    }
  };

  const exportToCSV = () => {
    if (registrations.length === 0) {
      toast.error('No registrations to export');
      return;
    }

    // Get all unique form fields
    const allFields = new Set();
    registrations.forEach(reg => {
      Object.keys(reg.formResponse).forEach(key => allFields.add(key));
    });

    const headers = ['Registration ID', 'Status', 'Date', ...Array.from(allFields), 'Payment Status', 'Check-in Status', 'Check-in Time'];
    const rows = registrations.map(reg => [
      reg.id,
      reg.status,
      format(new Date(reg.createdAt), 'PPP'),
      ...Array.from(allFields).map(field => reg.formResponse[field] || ''),
      reg.orders[0]?.status || 'N/A',
      reg.orders[0]?.ticket?.scannedAt ? 'Checked In' : reg.orders[0]?.ticket ? 'Not Checked In' : 'No Ticket',
      reg.orders[0]?.ticket?.scannedAt ? format(new Date(reg.orders[0].ticket.scannedAt), 'PPp') : '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-${event?.slug || 'event'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('CSV downloaded successfully');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E23744] border-r-2 border-[#E23744]/30"></div>
      </div>
    );
  }

  const paidRegistrations = registrations.filter(r => r.status === 'PAID').length;
  const totalRevenue = registrations
    .filter(r => r.status === 'PAID')
    .reduce((sum, r) => sum + (r.orders[0]?.amountCents || 0), 0) / 100;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">{event?.title}</h1>
          <p className="text-gray-400 mt-2">Event Registrations</p>
        </div>
        <button onClick={exportToCSV} className="btn btn-primary">
          <Download size={20} className="mr-2" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 bg-[#18181b]/60 border border-white/5">
          <p className="text-sm text-gray-400 mb-1">Total Registrations</p>
          <p className="text-3xl font-bold text-white">{registrations.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-6 bg-[#18181b]/60 border border-white/5">
          <p className="text-sm text-gray-400 mb-1">Paid Registrations</p>
          <p className="text-3xl font-bold text-green-400">{paidRegistrations}</p>
        </div>
        <div className="glass-card rounded-2xl p-6 bg-[#18181b]/60 border border-white/5">
          <p className="text-sm text-gray-400 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-[#E23744]">₹{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="glass-card rounded-2xl p-6 bg-[#18181b]/60 border border-white/5 overflow-hidden">
        {registrations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No registrations yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Attendee</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Ticket</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Check-in</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => (
                  <tr key={registration.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-white">
                      {registration.formResponse.name || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {registration.userEmail}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={registration.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {format(new Date(registration.createdAt), 'PPP')}
                    </td>
                    <td className="py-3 px-4">
                      {registration.orders[0]?.ticket ? (
                        <span className="badge badge-success">
                          <CheckCircle size={14} className="mr-1" />
                          Generated
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <Clock size={14} className="mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {registration.orders[0]?.ticket?.scannedAt ? (
                        <div className="flex flex-col">
                          <span className="badge badge-success">
                            <CheckCircle size={14} className="mr-1" />
                            Checked In
                          </span>
                          <span className="text-xs text-gray-500 mt-1">
                            {format(new Date(registration.orders[0].ticket.scannedAt), 'PPp')}
                          </span>
                        </div>
                      ) : registration.orders[0]?.ticket ? (
                        <span className="badge badge-secondary">
                          <XCircle size={14} className="mr-1" />
                          Not Checked In
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {registration.orders[0]?.ticket && !registration.orders[0]?.ticket?.scannedAt && (
                          <button
                            onClick={() => handleCheckIn(registration.orders[0].ticket.id, registration.formResponse.name)}
                            className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 p-2 rounded-lg transition-colors"
                            title="Manual Check-in"
                          >
                            <LogIn size={18} />
                          </button>
                        )}
                        {registration.orders[0]?.ticket?.scannedAt && (
                          <button
                            onClick={() => handleResetCheckin(registration.orders[0].ticket.id)}
                            className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 p-2 rounded-lg transition-colors"
                            title="Reset Check-in"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteRegistration(registration.id, registration.formResponse.name)}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                          title="Delete registration"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const variants = {
    PAID: { className: 'badge-success', icon: CheckCircle, text: 'Paid' },
    PENDING: { className: 'badge-warning', icon: Clock, text: 'Pending' },
    CANCELLED: { className: 'badge-danger', icon: XCircle, text: 'Cancelled' }
  };

  const variant = variants[status] || variants.PENDING;
  const Icon = variant.icon;

  return (
    <span className={`badge ${variant.className}`}>
      <Icon size={14} className="mr-1" />
      {variant.text}
    </span>
  );
}
