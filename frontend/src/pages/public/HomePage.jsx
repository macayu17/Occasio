import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import api, { getImageUrl } from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import FloatingLines from '../../components/FloatingLines';

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await api.get('/events');
      setEvents(response.data);
    } catch (error) {
      toast.error('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20 bg-[#09090b]">
      {/* Hero Section */}
      <section className="relative py-28 px-4 mb-16 overflow-hidden">
        {/* Background Floating Lines - Subtle & Dark */}
        <div className="absolute inset-0 w-full h-full opacity-40 pointer-events-none">
          <FloatingLines
            linesGradient={['#333333', '#111111', '#E23744', '#1a1a1a']}
            enabledWaves={['top', 'bottom']}
            lineCount={[8, 12]}
            lineDistance={[8, 10]}
            animationSpeed={0.5}
            interactive={true}
            mixBlendMode="lighten"
          />
        </div>

        {/* Static Gradient Orbs for Glass Pop */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-red-900/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Glass Overlay on Bottom Fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#09090b] to-transparent z-10"></div>

        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-nav border border-white/10 mb-8 animate-fade-in text-gray-400 text-sm font-medium">
            <Sparkles size={14} className="text-[#E23744]" />
            <span>Discover extraordinary events</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold mb-8 tracking-tighter text-white animate-slide-up">
            Find your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-gray-400 to-gray-600">
              experience.
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed animate-slide-up animation-delay-100">
            From underground gigs to tech conferences.
            Book your next memory with Occasio.
          </p>

          {/* Glass Search Bar */}
          <div className="relative max-w-2xl mx-auto group animate-scale-in animation-delay-200">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#E23744]/20 via-white/5 to-[#E23744]/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="relative glass-card flex items-center p-2 rounded-2xl border border-white/10 shadow-2xl bg-[#09090b]/60 backdrop-blur-xl">
              <Search className="ml-4 text-gray-400 group-focus-within:text-[#E23744] transition-colors" size={24} />
              <input
                type="text"
                placeholder="Search for events, artists, or venues..."
                className="w-full bg-transparent border-none text-white placeholder-gray-500 text-lg px-4 py-3 focus:ring-0 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            Trending Events
            <div className="h-2 w-2 rounded-full bg-[#E23744] animate-pulse"></div>
          </h2>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <FilterPill label="All Events" active />
            <FilterPill label="Music" />
            <FilterPill label="Workshops" />
            <FilterPill label="Meetups" />
            <FilterPill label="Sports" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white border-r-2 border-white/20"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-32 glass-card rounded-3xl border border-white/5 bg-[#121212]/50">
            <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
              <Search size={32} className="text-gray-500" />
            </div>
            <p className="text-gray-400 text-xl font-medium">No events found matching your search.</p>
            <p className="text-gray-600 mt-2">Try checking your spelling or use different keywords.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event, idx) => (
              <div key={event.id} className="animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                <EventCard event={event} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterPill({ label, active }) {
  return (
    <button className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${active
      ? 'bg-white text-black shadow-lg shadow-white/10'
      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
      }`}>
      {label}
    </button>
  );
}

function EventCard({ event }) {
  // Use helper for proper image URL resolution
  const posterImage = getImageUrl(event.posterUrl) || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80';

  return (
    <Link to={`/events/${event.id}`} className="group block h-full">
      <div className="glass-card relative overflow-hidden rounded-3xl border border-white/10 bg-[#18181b]/60 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-[#E23744]/10 h-full flex flex-col p-3">

        {/* Image Container with Hover Effect */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-900">
          <img
            src={posterImage}
            alt={event.title}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 will-change-transform"
            loading="lazy"
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80";
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>

          <div className="absolute top-3 right-3">
            <div className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">
              {event.priceCents === 0 ? 'FREE' : `₹${(event.priceCents / 100).toFixed(0)}`}
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <div className="bg-white text-black text-center py-2.5 rounded-xl font-bold text-sm shadow-xl">
              Book Ticket
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-4 pb-2 px-1 flex flex-col flex-1">
          <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 leading-tight group-hover:text-[#E23744] transition-colors">
            {event.title}
          </h3>

          <div className="mt-auto space-y-2.5">
            <div className="flex items-center text-gray-400 text-sm group-hover:text-gray-300 transition-colors">
              <Calendar size={14} className="mr-2.5 text-gray-500" />
              {format(new Date(event.startTime), 'EEE, MMM d • h:mm a')}
            </div>
            <div className="flex items-center text-gray-400 text-sm group-hover:text-gray-300 transition-colors">
              <MapPin size={14} className="mr-2.5 text-gray-500" />
              <span className="truncate">{event.location}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
