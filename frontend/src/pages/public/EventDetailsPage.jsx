import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, Users, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function EventDetailsPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/events/${id}`);
      setEvent(response.data);
    } catch (error) {
      toast.error('Failed to fetch event details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
          <Link to="/" className="btn btn-primary">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const availableSlots = event.capacity - (event._count?.registrations || 0);
  const isFull = availableSlots <= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/" className="inline-flex items-center text-primary-500 hover:text-primary-600 mb-6">
          <ArrowLeft size={20} className="mr-2" />
          Back to Events
        </Link>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {event.posterUrl && (
            <img
              src={event.posterUrl}
              alt={event.title}
              className="w-full h-96 object-cover"
            />
          )}

          <div className="p-8">
            <h1 className="text-4xl font-bold mb-4">{event.title}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center text-gray-600">
                <Calendar size={20} className="mr-3 text-primary-500" />
                <div>
                  <p className="font-medium">Date & Time</p>
                  <p className="text-sm">{format(new Date(event.startTime), 'PPP p')}</p>
                </div>
              </div>

              <div className="flex items-center text-gray-600">
                <MapPin size={20} className="mr-3 text-primary-500" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-sm">{event.location}</p>
                </div>
              </div>

              <div className="flex items-center text-gray-600">
                <DollarSign size={20} className="mr-3 text-primary-500" />
                <div>
                  <p className="font-medium">Price</p>
                  <p className="text-sm">
                    {event.priceCents === 0
                      ? 'Free'
                      : `${event.currency} ${(event.priceCents / 100).toFixed(2)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center text-gray-600">
                <Users size={20} className="mr-3 text-primary-500" />
                <div>
                  <p className="font-medium">Available Slots</p>
                  <p className="text-sm">{availableSlots} / {event.capacity}</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">About This Event</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">Organized By</h3>
              <p className="text-gray-600">{event.organizer.name}</p>
            </div>

            {isFull ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800 font-medium">This event is fully booked</p>
              </div>
            ) : (
              <Link
                to={`/events/${event.id}/register`}
                className="btn btn-primary w-full py-4 text-lg"
              >
                Register Now
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
