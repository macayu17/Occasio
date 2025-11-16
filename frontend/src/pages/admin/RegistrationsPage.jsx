import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, CheckCircle, XCircle, Clock } from 'lucide-react';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
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
          <h1 className="text-3xl font-bold">{event?.title}</h1>
          <p className="text-gray-600 mt-2">Event Registrations</p>
        </div>
        <button onClick={exportToCSV} className="btn btn-primary">
          <Download size={20} className="mr-2" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-sm text-gray-600 mb-1">Total Registrations</p>
          <p className="text-3xl font-bold">{registrations.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 mb-1">Paid Registrations</p>
          <p className="text-3xl font-bold text-green-600">{paidRegistrations}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-primary-600">₹{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="card">
        {registrations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No registrations yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Attendee</th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Ticket</th>
                  <th className="text-left py-3 px-4 font-semibold">Check-in</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => (
                  <tr key={registration.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {registration.formResponse.name || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      {registration.userEmail}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={registration.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
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
                        <span className="text-gray-400 text-sm">-</span>
                      )}
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
