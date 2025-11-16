import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, Users, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ShareButton from '../../components/ShareButton';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-900"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 absolute top-0"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Event not found</h2>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/" className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-6 font-medium">
          <ArrowLeft size={20} className="mr-2" />
          Back to Events
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {event.posterUrl && (
            <div className="relative h-96 overflow-hidden">
              <img
                src={event.posterUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
          )}

          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex-1">{event.title}</h1>
              <ShareButton event={event} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="bg-primary-100 dark:bg-primary-900/30 p-3 rounded-lg mr-4">
                  <Calendar size={24} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Date & Time</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{format(new Date(event.startTime), 'PPP p')}</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="bg-secondary-100 dark:bg-secondary-900/30 p-3 rounded-lg mr-4">
                  <MapPin size={24} className="text-secondary-600 dark:text-secondary-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Location</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{event.location}</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg mr-4">
                  <DollarSign size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Price</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {event.priceCents === 0
                      ? 'Free'
                      : `${event.currency} ${(event.priceCents / 100).toFixed(2)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg mr-4">
                  <Users size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Available Slots</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{availableSlots} / {event.capacity}</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">About This Event</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{event.description}</p>
            </div>

            <div className="mb-8 p-6 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Organized By</h3>
              <p className="text-gray-700 dark:text-gray-300 font-medium">{event.organizer.name}</p>
            </div>

            {isFull ? (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                <p className="text-red-800 dark:text-red-400 font-semibold text-lg">This event is fully booked</p>
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
