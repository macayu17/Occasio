import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, FileText, Users, Eye, EyeOff, BarChart3, MoreVertical, MapPin, CalendarDays, Tag, Copy, Settings } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Dock from '../../components/Dock';

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (events.length === 0) {
      setSelectedEventId(null);
      return;
    }

    if (!selectedEventId || !events.some(event => event.id === selectedEventId)) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const toggleMenu = (e, eventId) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === eventId ? null : eventId);
  };

  const handleAction = (action, eventId) => {
    setOpenMenuId(null);

    switch (action) {
      case 'edit':
        navigate(`/admin/events/${eventId}/edit`);
        break;
      case 'form':
        navigate(`/admin/events/${eventId}/form`);
        break;
      case 'registrations':
        navigate(`/admin/events/${eventId}/registrations`);
        break;
      case 'analytics':
        navigate(`/admin/events/${eventId}/analytics`);
        break;
      case 'control':
        navigate(`/admin/events/${eventId}/control`);
        break;
      case 'discounts':
        navigate(`/admin/events/${eventId}/discounts`);
        break;
      case 'delete':
        handleDelete(eventId);
        break;
      case 'toggle': {
        const event = events.find(e => e.id === eventId);
        if (event) togglePublish(eventId, event.published);
        break;
      }
      case 'duplicate':
        handleDuplicate(eventId);
        break;
      case 'view':
        window.open(`/events/${eventId}`, '_blank');
        break;
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

  const handleDuplicate = async (id) => {
    try {
      const event = events.find(e => e.id === id);
      if (!event) return;

      const newEvent = {
        title: `${event.title} (Copy)`,
        description: event.description,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        capacity: event.capacity,
        priceCents: event.priceCents
      };

      await api.post('/admin/events', newEvent);
      toast.success('Event duplicated successfully');
      fetchEvents();
    } catch (error) {
      toast.error('Failed to duplicate event');
    }
  };

  const selectedEvent = events.find(event => event.id === selectedEventId);
  const dockItems = selectedEvent ? [
    {
      label: 'Public',
      icon: <Eye size={20} />,
      onClick: () => handleAction('view', selectedEvent.id)
    },
    {
      label: 'Edit',
      icon: <Edit size={20} />,
      onClick: () => handleAction('edit', selectedEvent.id)
    },
    {
      label: 'Registrations',
      icon: <Users size={20} />,
      onClick: () => handleAction('registrations', selectedEvent.id)
    },
    {
      label: 'Control',
      icon: <Settings size={20} />,
      onClick: () => handleAction('control', selectedEvent.id)
    },
    {
      label: 'Analytics',
      icon: <BarChart3 size={20} />,
      onClick: () => handleAction('analytics', selectedEvent.id)
    },
    {
      label: 'Discounts',
      icon: <Tag size={20} />,
      onClick: () => handleAction('discounts', selectedEvent.id)
    },
    {
      label: 'Form',
      icon: <FileText size={20} />,
      onClick: () => handleAction('form', selectedEvent.id)
    },
    {
      label: 'Duplicate',
      icon: <Copy size={20} />,
      onClick: () => handleAction('duplicate', selectedEvent.id)
    },
    {
      label: selectedEvent.published ? 'Unpublish' : 'Publish',
      icon: selectedEvent.published ? <EyeOff size={20} /> : <Eye size={20} />,
      onClick: () => handleAction('toggle', selectedEvent.id)
    },
    {
      label: 'Delete',
      icon: <Trash2 size={20} />,
      onClick: () => handleAction('delete', selectedEvent.id)
    }
  ] : [];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E23744] border-r-2 border-[#E23744]/30"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in relative min-h-screen pb-36">
      <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="admin-eyebrow mb-3">Event ledger</p>
          <h1 className="mb-3 text-4xl font-black tracking-tight text-[#f7efe3] md:text-5xl">My Events</h1>
          <p className="admin-muted max-w-2xl">Manage, edit, and track your events. Select any row to use the quick action buttons below.</p>
        </div>
        <Link to="/admin/events/create" className="admin-primary-action flex items-center gap-2 self-start xl:self-auto">
          <Plus size={20} />
          <span>New Event</span>
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="admin-card border-dashed text-center py-20">
          <CalendarDays className="mx-auto text-gray-600 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No events found</h3>
          <p className="text-gray-400 mb-6">Get started by creating your first event.</p>
          <Link to="/admin/events/create" className="admin-primary-action inline-flex">
            Create Event
          </Link>
        </div>
      ) : (
        <div className="space-y-4 overflow-visible">
          {events.map((event, index) => (
            <div
              key={event.id}
              onClick={() => setSelectedEventId(event.id)}
              className={`admin-card admin-card-hover group animate-slide-up relative cursor-pointer p-5 ${openMenuId === event.id ? 'z-[100]' : ''} ${selectedEventId === event.id ? 'border-[#f2e7d8]/35 bg-[#191511] shadow-[#E23744]/10' : ''}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-black text-[#f7efe3] transition-colors group-hover:text-white" onClick={(e) => { e.stopPropagation(); navigate(`/admin/events/${event.id}/edit`); }}>
                      {event.title}
                    </h3>
                    <span className={`admin-chip ${event.published ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                      {event.published ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 text-sm text-[#aaa096]">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-[#8f867d]" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className="text-[#8f867d]" />
                      {format(new Date(event.startTime), 'MMM d, yyyy • h:mm a')}
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:gap-4">
                  <div className="text-right px-3 border-r border-white/10 md:px-4">
                    <div className="text-2xl font-black text-[#f7efe3]">{event._count?.registrations || 0}</div>
                    <div className="text-[0.65rem] uppercase tracking-[0.16em] text-[#8f867d]">Registrations</div>
                  </div>

                  <div className="text-right px-3 border-r border-white/10 md:px-4">
                    <div className="text-2xl font-black text-[#f7efe3]">
                      {event.priceCents === 0 ? 'FREE' : `₹${event.priceCents / 100}`}
                    </div>
                    <div className="text-[0.65rem] uppercase tracking-[0.16em] text-[#8f867d]">Price</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-auto flex shrink-0 gap-2 pl-0 md:pl-2">
                    <Link to={`/admin/events/${event.id}/registrations`} className="admin-icon-button" title="View Registrations" onClick={(e) => e.stopPropagation()}>
                      <Users size={18} />
                    </Link>
                    <Link to={`/admin/events/${event.id}/edit`} className="admin-icon-button" title="Edit" onClick={(e) => e.stopPropagation()}>
                      <Edit size={18} />
                    </Link>

                    {/* Dropdown Menu */}
                    <div className="relative" ref={openMenuId === event.id ? menuRef : null}>
                      <button
                        onClick={(e) => toggleMenu(e, event.id)}
                        className="admin-icon-button"
                        title="More Options"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {openMenuId === event.id && (
                        <div className="absolute right-0 top-full mt-2 z-[9999] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-2 w-52 text-sm backdrop-blur-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleAction('view', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            <Eye size={14} /> View Public Page
                          </button>
                          <button onClick={() => handleAction('edit', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            <Edit size={14} /> Edit Event
                          </button>
                          <button onClick={() => handleAction('duplicate', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            <Copy size={14} /> Duplicate Event
                          </button>
                          <div className="border-t border-white/10 my-1"></div>
                          <button onClick={() => handleAction('registrations', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            <Users size={14} /> Registrations
                          </button>
                          <button onClick={() => handleAction('control', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-[#E23744] flex items-center gap-3 font-medium">
                            <Settings size={14} /> Control Center
                          </button>
                          <button onClick={() => handleAction('analytics', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            <BarChart3 size={14} /> Analytics
                          </button>
                          <button onClick={() => handleAction('discounts', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            <Tag size={14} /> Discounts
                          </button>
                          <button onClick={() => handleAction('form', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            <FileText size={14} /> Form Builder
                          </button>
                          <div className="border-t border-white/10 my-1"></div>
                          <button onClick={() => handleAction('toggle', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white flex items-center gap-3">
                            {event.published ? <EyeOff size={14} /> : <Eye size={14} />}
                            {event.published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button onClick={() => handleAction('delete', event.id)} className="w-full text-left px-4 py-2.5 hover:bg-red-500/20 text-red-500 flex items-center gap-3">
                            <Trash2 size={14} /> Delete Event
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedEvent && (
        <div className="fixed bottom-8 left-1/2 z-50 w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 lg:left-[calc(50%+9rem)]">
          <Dock
            items={dockItems}
            className="mx-auto"
            magnification={62}
            baseItemSize={46}
            distance={110}
            panelHeight={102}
            minimal
          />
        </div>
      )}
    </div>
  );
}
