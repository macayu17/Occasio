import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ArrowLeft, Loader2, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api, { getImageUrl } from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ShareButton from '../../components/ShareButton';
import ShareButtons from '../../components/ShareButtons';
import CountdownTimer from '../../components/CountdownTimer';
import PollsSection from '../../components/PollsSection';
import ReviewsSection from '../../components/ReviewsSection';

export default function EventDetailsPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waitlistJoined, setWaitlistJoined] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

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

  const onJoinWaitlist = async (data) => {
    try {
      await api.post(`/events/${event.id}/waitlist`, data);
      setWaitlistJoined(true);
      toast.success('Successfully joined the waitlist!');
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to join waitlist';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E23744]"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Event not found</h2>
          <Link to="/" className="btn btn-primary">Back to Events</Link>
        </div>
      </div>
    );
  }

  const availableSlots = event.capacity - (event._count?.registrations || 0);
  const isFull = availableSlots <= 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-white pb-20 relative overflow-hidden font-['Inter']">
      {/* Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#E23744]/10 rounded-full blur-[100px]" />
      </div>

      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors group">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mr-3 group-hover:bg-white/10 transition-all border border-white/5">
            <ArrowLeft size={16} />
          </div>
          <span className="text-sm font-medium">Back to Events</span>
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Share Mobile */}
            <div className="flex justify-between items-start lg:hidden">
              <h1 className="text-3xl font-bold text-white tracking-tight">{event.title}</h1>
              <ShareButton event={event} />
            </div>

            {/* Poster Image */}
            <div className="aspect-video w-full rounded-3xl overflow-hidden border border-white/10 bg-[#18181b] shadow-2xl relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent opacity-60 z-10" />
              <img
                src={getImageUrl(event.posterUrl) || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'}
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

            {/* Desktop Title */}
            <div className="hidden lg:flex justify-between items-start">
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">{event.title}</h1>
              <div className="flex gap-2">
                <ShareButtons event={event} />
              </div>
            </div>

            {/* Organized By */}
            <div className="flex items-center space-x-4 bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E23744] to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {event.organizer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-gray-400">Organized by</p>
                <p className="font-semibold text-white">{event.organizer.name}</p>
              </div>
            </div>

            {/* Description */}
            <div className="glass-card bg-[#18181b]/60 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                About this event
              </h3>
              <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>

            {/* Polls Section */}
            {new Date(event.endTime) > new Date() && (
              <PollsSection eventId={id} />
            )}

            {/* Reviews Section */}
            <ReviewsSection eventId={id} eventEndTime={event.endTime} />
          </div>

          {/* Sidebar (Right) */}
          <div className="space-y-6">
            {/* Countdown Timer */}
            <div className="glass-card bg-[#18181b]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl">
              <CountdownTimer targetDate={event.startTime} />
            </div>

            {/* Booking Card */}
            <div className="glass-card bg-[#18181b]/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl sticky top-8">
              <div className="mb-6">
                <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Price per ticket</p>
                <div className="flex items-baseline gap-1">
                  {event.priceCents === 0 ? (
                    <span className="text-4xl font-bold text-white">Free</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-[#E23744] align-top mt-1">₹</span>
                      <span className="text-5xl font-bold text-white tracking-tight">{(event.priceCents / 100).toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start space-x-4 group">
                  <div className="p-3 rounded-xl bg-white/5 text-[#E23744] group-hover:bg-[#E23744]/10 transition-colors">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Date and Time</p>
                    <p className="text-sm text-gray-400 mt-1">{format(new Date(event.startTime), 'EEEE, MMMM d, yyyy')}</p>
                    <p className="text-sm text-gray-400">{format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}</p>
                    {/* Add to Calendar Link placeholder if needed */}
                  </div>
                </div>

                <div className="flex items-start space-x-4 group">
                  <div className="p-3 rounded-xl bg-white/5 text-[#E23744] group-hover:bg-[#E23744]/10 transition-colors">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Location</p>
                    <p className="text-sm text-gray-400 mt-1">{event.location}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#E23744] hover:text-[#ff4d5a] mt-2 inline-block transition-colors underline-offset-4 hover:underline"
                    >
                      View on map
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-4 group">
                  <div className="p-3 rounded-xl bg-white/5 text-[#E23744] group-hover:bg-[#E23744]/10 transition-colors">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Availability</p>
                    <p className={`text-sm mt-1 font-medium ${isFull ? 'text-red-500' : 'text-emerald-400'}`}>
                      {isFull ? 'Sold Out' : `${availableSlots} spots left`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-white/10">
                {isFull ? (
                  !waitlistJoined ? (
                    <button
                      onClick={handleSubmit(onJoinWaitlist)}
                      disabled={isSubmitting}
                      className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all border border-white/5 hover:border-white/20"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Join Waitlist'}
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-emerald-500/10 text-emerald-500 rounded-xl font-bold text-center border border-emerald-500/20">
                      Added to Waitlist
                    </div>
                  )
                ) : (
                  <Link
                    to={`/events/${id}/register`}
                    className="block w-full py-4 bg-[#E23744] hover:bg-[#c92633] text-white text-center rounded-xl font-bold text-lg shadow-lg shadow-[#E23744]/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Book Tickets
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}
