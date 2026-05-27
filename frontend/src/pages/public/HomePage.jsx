import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Calendar, Sparkles, RefreshCw, WifiOff, X } from 'lucide-react';
import api, { getImageUrl } from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Category definitions
const CATEGORIES = [
  { value: 'ALL', label: 'All Events' },
  { value: 'MUSIC', label: 'Music' },
  { value: 'TECH', label: 'Tech' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'ARTS', label: 'Arts' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'FOOD', label: 'Food' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'SOCIAL', label: 'Social' }
];

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [error, setError] = useState('');

  const activeCategory = CATEGORIES.find(cat => cat.value === categoryFilter);
  const hasFilters = Boolean(debouncedSearch) || categoryFilter !== 'ALL';
  const sectionTitle = debouncedSearch
    ? 'Search Results'
    : `${activeCategory?.label || 'All Events'}`;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch events when filters change
  useEffect(() => {
    const controller = new AbortController();
    fetchEvents(controller.signal);
    return () => controller.abort();
  }, [debouncedSearch, categoryFilter]);

  const fetchEvents = async (signal) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('upcoming', 'true');
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (categoryFilter && categoryFilter !== 'ALL') params.append('category', categoryFilter);

      const response = await api.get(`/events?${params.toString()}`, { signal });
      setEvents(response.data);
    } catch (error) {
      if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return;
      setError('We could not load events right now. Check the backend connection and try again.');
      toast.error('Failed to fetch events');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 relative z-10">
      {/* Hero Section */}
      <section className="relative px-4 pb-12 pt-8 sm:pt-10 lg:pt-12 mb-4 overflow-hidden">

        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-nav border border-white/10 mb-8 animate-fade-in text-gray-400 text-sm font-medium">
            <Sparkles size={14} className="text-[#E23744]" />
            <span>Discover extraordinary events</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold mb-5 tracking-tighter text-white animate-slide-up">
            Find your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-gray-400 to-gray-600">
              experience.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 mb-6 max-w-2xl mx-auto font-light leading-relaxed animate-slide-up animation-delay-100">
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
                aria-label="Search events"
                className="w-full bg-transparent border-none text-white placeholder-gray-500 text-lg px-4 py-3 focus:ring-0 font-medium font-['Outfit']"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="mr-3 rounded-full p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E23744]"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-medium uppercase tracking-[0.24em] text-gray-500 animate-fade-in animation-delay-100">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Curated events</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">QR tickets</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Fast checkout</span>
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
              {sectionTitle}
              <div className="h-2 w-2 rounded-full bg-[#E23744] animate-pulse"></div>
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {loading ? 'Finding the best matches...' : `${events.length} ${events.length === 1 ? 'event' : 'events'} available`}
              {debouncedSearch ? ` for "${debouncedSearch}"` : ''}
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" aria-label="Filter events by category">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                aria-pressed={categoryFilter === cat.value}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${categoryFilter === cat.value
                  ? 'bg-white text-black shadow-lg shadow-white/10'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-label="Loading events">
            {Array.from({ length: 6 }).map((_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24 glass-card rounded-3xl border border-red-500/10 bg-red-500/[0.03]">
            <div className="inline-flex p-4 rounded-full bg-red-500/10 mb-4 text-red-300">
              <WifiOff size={32} />
            </div>
            <p className="text-white text-xl font-semibold">Could not load events</p>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">{error}</p>
            <button onClick={fetchEvents} className="btn btn-primary mx-auto mt-6">
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-32 glass-card rounded-3xl border border-white/5 bg-[#121212]/50">
            <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
              <Search size={32} className="text-gray-500" />
            </div>
            <p className="text-gray-400 text-xl font-medium">No events found matching your search.</p>
            <p className="text-gray-600 mt-2">Try checking your spelling, changing category, or clearing filters.</p>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('ALL');
                }}
                className="btn btn-secondary mx-auto mt-6"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event, idx) => (
              <div key={event.id} className="animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                <EventCard event={event} priority={idx < 3} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="glass-card rounded-3xl border border-white/10 bg-[#18181b]/50 p-3">
      <div className="aspect-[4/3] rounded-2xl bg-white/[0.06] animate-pulse" />
      <div className="px-1 pb-2 pt-4">
        <div className="h-5 w-3/4 rounded-full bg-white/[0.08] animate-pulse" />
        <div className="mt-5 space-y-3">
          <div className="h-4 w-1/2 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-2/3 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, priority = false }) {
  // Use helper for proper image URL resolution
  const posterImage = getImageUrl(event.posterUrl) || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80';
  const priceCents = Number(event.priceCents || 0);

  return (
    <Link to={`/events/${event.id}`} className="group block h-full" aria-label={`View details for ${event.title}`}>
      <div className="glass-card relative overflow-hidden rounded-3xl border border-white/10 bg-[#18181b]/60 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-[#E23744]/10 h-full flex flex-col p-3">

        {/* Image Container with Hover Effect */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-900">
          <img
            src={posterImage}
            alt={`${event.title} poster`}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 will-change-transform"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80";
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>

          <div className="absolute top-3 right-3">
            <div className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">
              {priceCents === 0 ? 'FREE' : `₹${(priceCents / 100).toFixed(0)}`}
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
