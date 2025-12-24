import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ShareButton from '../../components/ShareButton';
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
    <div className="min-h-screen pb-20">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          Back to Events
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Share Mobile */}
            <div className="flex justify-between items-start lg:hidden">
              <h1 className="text-3xl font-bold text-white gradient-text">{event.title}</h1>
              <ShareButton event={event} />
            </div>

            {/* Poster Image */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/5 bg-[#18181b]">
              <img
                src={event.posterUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'}
                alt={event.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>

            {/* Desktop Title */}
            <div className="hidden lg:flex justify-between items-start">
              <h1 className="text-4xl font-bold text-white gradient-text">{event.title}</h1>
              <ShareButton event={event} />
            </div>

            {/* Description */}
            <div className="card">
              <h2 className="text-xl font-bold text-white mb-4">About this event</h2>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>

            {/* Organizer */}
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center text-gray-400 font-bold text-lg">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Organized by</p>
                <p className="text-white font-medium">{event.organizer.name}</p>
              </div>
            </div>

            {/* Reviews */}
            <ReviewsSection eventId={event.id} />
          </div>


          {/* Sidebar (Right) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <div className="card space-y-6 border-[#E23744]/20 ring-1 ring-[#E23744]/20 shadow-[0_0_50px_-15px_rgba(226,55,68,0.15)]">
                {/* Price & Action */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Price per ticket</p>
                    <p className="text-2xl font-bold text-white">
                      {event.priceCents === 0 ? 'Free' : `₹${(event.priceCents / 100).toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <hr className="border-white/10" />

                {/* Details */}
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Calendar className="text-gray-500 mt-1" size={20} />
                    <div>
                      <p className="font-medium text-white">Date and Time</p>
                      <p className="text-sm text-gray-400">
                        {format(new Date(event.startTime), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-400">
                        {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
                      </p>
                      <a
                        href={`/api/events/${event.id}/calendar`}
                        className="text-xs text-[#E23744] hover:text-[#E23744]/80 mt-2 inline-flex items-center gap-1 font-medium transition-colors"
                        title="Download .ics file"
                      >
                        <Calendar size={12} /> Add to Calendar
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <MapPin className="text-gray-500 mt-1" size={20} />
                    <div className="w-full">
                      <p className="font-medium text-white">Location</p>
                      <p className="text-sm text-gray-400 mb-2">{event.location}</p>
                      {/* Google Maps Embed */}
                      <div className="w-full h-40 rounded-lg overflow-hidden border border-white/10 mt-2 bg-[#18181b]">
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          marginHeight="0"
                          marginWidth="0"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                          title="Event Location"
                          className="filter grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
                        ></iframe>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Users className="text-gray-500 mt-1" size={20} />
                    <div>
                      <p className="font-medium text-white">Availability</p>
                      <p className={`text-sm ${isFull ? 'text-red-500' : 'text-emerald-500'}`}>
                        {isFull ? 'Sold Out' : `${availableSlots} spots left`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button & Waitlist */}
                {isFull ? (
                  !waitlistJoined ? (
                    <div className="animate-fade-in bg-[#18181b] p-4 rounded-xl border border-white/5">
                      <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                        Join Waitlist
                      </p>
                      <form onSubmit={handleSubmit(onJoinWaitlist)} className="space-y-3">
                        <div>
                          <input
                            type="text"
                            placeholder="Full Name"
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#E23744] outline-none"
                            {...register('name', { required: true })}
                          />
                        </div>
                        <div>
                          <input
                            type="email"
                            placeholder="Email Address"
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#E23744] outline-none"
                            {...register('email', { required: true, pattern: /^\S+@\S+$/i })}
                          />
                        </div>
                        <button
                          disabled={isSubmitting}
                          className="btn btn-primary w-full py-2 text-sm justify-center"
                        >
                          {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Notify Me'}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl text-center">
                      <p className="text-green-500 font-medium text-sm">You joined the waitlist!</p>
                      <p className="text-gray-400 text-xs mt-1">We'll email you if a spot opens up.</p>
                    </div>
                  )
                ) : (
                  <Link
                    to={`/events/${id}/register`}
                    className="btn btn-primary w-full py-3 justify-center text-base shadow-[0_0_20px_-5px_#E23744]"
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
