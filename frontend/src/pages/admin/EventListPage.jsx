import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, FileText, Users } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await api.get('/admin/events');
      setEvents(response.data);
    } catch (error) {
      toast.error('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await api.delete(`/admin/events/${id}`);
      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const togglePublish = async (id, currentStatus) => {
    try {
      await api.put(`/admin/events/${id}`, {
        published: !currentStatus
      });
      toast.success(`Event ${!currentStatus ? 'published' : 'unpublished'} successfully`);
      fetchEvents();
    } catch (error) {
      toast.error('Failed to update event');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Events</h1>
        <Link to="/admin/events/create" className="btn btn-primary">
          <Plus size={20} className="mr-2" />
          Create Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No events created yet</p>
          <Link to="/admin/events/create" className="btn btn-primary">
            Create Your First Event
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {events.map((event) => (
            <div key={event.id} className="card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{event.title}</h3>
                    <span className={`badge ${event.published ? 'badge-success' : 'badge-warning'}`}>
                      {event.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2">{event.location}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(event.startTime), 'PPP')}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span>{event._count?.registrations || 0} registrations</span>
                    <span>
                      {event.priceCents === 0
                        ? 'Free'
                        : `${event.currency} ${(event.priceCents / 100).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/admin/events/${event.id}/edit`}
                    className="btn btn-secondary"
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Link>
                  
                  <Link
                    to={`/admin/events/${event.id}/form`}
                    className="btn btn-secondary"
                  >
                    <FileText size={16} className="mr-1" />
                    Form
                  </Link>
                  
                  <Link
                    to={`/admin/events/${event.id}/registrations`}
                    className="btn btn-secondary"
                  >
                    <Users size={16} className="mr-1" />
                    Registrations
                  </Link>
                  
                  <button
                    onClick={() => togglePublish(event.id, event.published)}
                    className="btn btn-secondary"
                  >
                    {event.published ? 'Unpublish' : 'Publish'}
                  </button>
                  
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="btn btn-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
