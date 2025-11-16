import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, FileText, Users, Eye, EyeOff, BarChart3 } from 'lucide-react';
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
      <div className="flex justify-center py-20">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-900"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">My Events</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage and track your events</p>
        </div>
        <Link to="/admin/events/create" className="btn btn-success">
          <Plus size={20} className="mr-2" />
          Create Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="card text-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-gray-400 dark:text-gray-600 mb-6">
            <Plus size={64} className="mx-auto" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">No events created yet</p>
          <Link to="/admin/events/create" className="btn btn-primary inline-flex items-center">
            <Plus size={20} className="mr-2" />
            Create Your First Event
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {events.map((event, index) => (
            <div 
              key={event.id} 
              className="card hover:shadow-2xl transform hover:-translate-y-1 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{event.title}</h3>
                    <span className={`badge ${event.published ? 'badge-success' : 'badge-warning'}`}>
                      {event.published ? '✓ Published' : '○ Draft'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="font-medium mr-2">📍</span>
                      {event.location}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="font-medium mr-2">📅</span>
                      {format(new Date(event.startTime), 'PPP')}
                    </p>
                    <div className="flex gap-6 mt-3">
                      <div className="bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-lg">
                        <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                          {event._count?.registrations || 0} registrations
                        </span>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg">
                        <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                          {event.priceCents === 0
                            ? '🎉 Free Event'
                            : `💰 ${event.currency} ${(event.priceCents / 100).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/admin/events/${event.id}/edit`}
                    className="btn btn-secondary text-sm py-2 px-4"
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Link>
                  
                  <Link
                    to={`/admin/events/${event.id}/form`}
                    className="btn btn-secondary text-sm py-2 px-4"
                  >
                    <FileText size={16} className="mr-1" />
                    Form
                  </Link>
                  
                  <Link
                    to={`/admin/events/${event.id}/registrations`}
                    className="btn btn-secondary text-sm py-2 px-4"
                  >
                    <Users size={16} className="mr-1" />
                    Registrations
                  </Link>
                  
                  <Link
                    to={`/admin/events/${event.id}/analytics`}
                    className="btn btn-secondary text-sm py-2 px-4"
                  >
                    <BarChart3 size={16} className="mr-1" />
                    Analytics
                  </Link>
                  
                  <button
                    onClick={() => togglePublish(event.id, event.published)}
                    className={`btn text-sm py-2 px-4 ${event.published ? 'btn-secondary' : 'btn-success'}`}
                  >
                    {event.published ? <EyeOff size={16} className="mr-1" /> : <Eye size={16} className="mr-1" />}
                    {event.published ? 'Unpublish' : 'Publish'}
                  </button>
                  
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="btn btn-danger text-sm py-2 px-4"
                    title="Delete event"
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
