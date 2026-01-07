import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, FileText, Users, Eye, EyeOff, BarChart3, MoreVertical, MapPin, CalendarDays, Tag } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, eventId }
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();

    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
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

  const handleContextMenu = (e, eventId) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, eventId });
  };

  const handleAction = (action, eventId) => {
    if (action === 'edit') navigate(`/admin/events/${eventId}/edit`);
    if (action === 'form') navigate(`/admin/events/${eventId}/form`);
    if (action === 'registrations') navigate(`/admin/events/${eventId}/registrations`);
    if (action === 'analytics') navigate(`/admin/events/${eventId}/analytics`);
    if (action === 'discounts') navigate(`/admin/events/${eventId}/discounts`);
    if (action === 'delete') handleDelete(eventId);
    if (action === 'toggle') {
      const event = events.find(e => e.id === eventId);
      if (event) togglePublish(eventId, event.published);
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E23744] border-r-2 border-[#E23744]/30"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in relative min-h-screen pb-20">
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-2 w-48 text-sm backdrop-blur-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={() => handleAction('edit', contextMenu.eventId)} className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex items-center gap-2">
            <Edit size={14} /> Edit Event
          </button>
          <button onClick={() => handleAction('registrations', contextMenu.eventId)} className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex items-center gap-2">
            <Users size={14} /> Registrations
          </button>
          <button onClick={() => handleAction('analytics', contextMenu.eventId)} className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex items-center gap-2">
            <BarChart3 size={14} /> Analytics
          </button>
          <button onClick={() => handleAction('discounts', contextMenu.eventId)} className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex items-center gap-2">
            <Tag size={14} /> Discounts
          </button>
          <button onClick={() => handleAction('form', contextMenu.eventId)} className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex items-center gap-2">
            <FileText size={14} /> Form Builder
          </button>
          <div className="border-t border-white/10 my-1"></div>
          <button onClick={() => handleAction('toggle', contextMenu.eventId)} className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex items-center gap-2">
            <Eye size={14} /> Toggle Publish
          </button>
          <button onClick={() => handleAction('delete', contextMenu.eventId)} className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-red-500 flex items-center gap-2">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Events</h1>
          <p className="text-gray-400">Manage, edit, and track your events.</p>
        </div>
        <Link to="/admin/events/create" className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          <span>New Event</span>
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="glass-card text-center py-20 border-dashed border-2 border-white/10 rounded-3xl bg-[#18181b]/40">
          <CalendarDays className="mx-auto text-gray-600 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No events found</h3>
          <p className="text-gray-400 mb-6">Get started by creating your first event.</p>
          <Link to="/admin/events/create" className="btn btn-primary inline-flex">
            Create Event
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 text-right italic mb-2">Tip: Right-click on a row for more options</p>
          {events.map((event, index) => (
            <div
              key={event.id}
              onContextMenu={(e) => handleContextMenu(e, event.id)}
              className="glass-card p-5 rounded-2xl bg-[#18181b]/60 border border-white/5 hover:border-[#E23744]/30 hover:bg-[#18181b] transition-all group relative animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-[#E23744] transition-colors cursor-pointer" onClick={() => navigate(`/admin/events/${event.id}/edit`)}>
                      {event.title}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${event.published ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                      {event.published ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-500" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className="text-gray-500" />
                      {format(new Date(event.startTime), 'MMM d, yyyy • h:mm a')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right px-4 border-r border-white/10">
                    <div className="text-2xl font-bold text-white">{event._count?.registrations || 0}</div>
                    <div className="text-xs text-gray-500 uppercase">Registrations</div>
                  </div>

                  <div className="text-right px-4 border-r border-white/10">
                    <div className="text-2xl font-bold text-white">
                      {event.priceCents === 0 ? 'FREE' : `₹${event.priceCents / 100}`}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">Price</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pl-2">
                    <Link to={`/admin/events/${event.id}/registrations`} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-[#E23744] transition-colors" title="View Registrations">
                      <Users size={18} />
                    </Link>
                    <Link to={`/admin/events/${event.id}/edit`} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Edit">
                      <Edit size={18} />
                    </Link>
                    <button onClick={(e) => handleContextMenu(e, event.id)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="More Options">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
