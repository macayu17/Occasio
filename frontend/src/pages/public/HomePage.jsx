import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, MapPin, DollarSign, TrendingUp, Users, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await api.get('/events?upcoming=true');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-accent-500 via-primary-500 to-primary-600 dark:from-accent-700 dark:via-primary-700 dark:to-primary-800">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-white/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-secondary-400/20 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/20">
              <Sparkles className="text-yellow-300" size={16} />
              <span className="text-white text-sm font-medium">Discover Amazing Experiences</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
              Find Your Next
              <span className="block bg-gradient-to-r from-secondary-300 to-secondary-500 bg-clip-text text-transparent">
                Amazing Event
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-12 text-primary-100 max-w-3xl mx-auto">
              Book tickets for concerts, workshops, conferences, and unforgettable experiences
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto animate-slide-up">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-pink-400 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
                  <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={24} />
                  <input
                    type="text"
                    placeholder="Search for events, locations, or categories..."
                    className="w-full pl-16 pr-6 py-5 rounded-2xl text-gray-900 dark:text-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mt-8 max-w-xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <TrendingUp className="text-secondary-300 mx-auto mb-2" size={24} />
                  <div className="text-2xl font-bold text-white">{events.length}+</div>
                  <div className="text-sm text-primary-100">Live Events</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <Users className="text-secondary-400 mx-auto mb-2" size={24} />
                  <div className="text-2xl font-bold text-white">10K+</div>
                  <div className="text-sm text-primary-100">Attendees</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <Sparkles className="text-secondary-500 mx-auto mb-2" size={24} />
                  <div className="text-2xl font-bold text-white">50+</div>
                  <div className="text-sm text-primary-100">Categories</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 75C1200 70 1320 50 1380 40L1440 30V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="currentColor" className="text-white dark:text-gray-900"/>
          </svg>
        </div>
      </section>

      {/* Events Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Trending Events</h2>
            <p className="text-gray-600 dark:text-gray-400">Don't miss out on these amazing experiences</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-900"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 absolute top-0"></div>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <Calendar className="mx-auto text-gray-400 dark:text-gray-600 mb-4" size={48} />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No events found</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Try adjusting your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event, index) => (
              <div 
                key={event.id} 
                className="animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <EventCard event={event} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventCard({ event }) {
  // Use the posterUrl if available, otherwise use a placeholder
  const posterImage = event.posterUrl || `https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80`;
  
  return (
    <Link to={`/events/${event.id}`} className="group">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 transform hover:-translate-y-2">
        <div className="relative h-56 overflow-hidden bg-gradient-to-br from-primary-500 to-secondary-500">
          <img
            src={posterImage}
            alt={event.title}
            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              // Fallback to gradient if image fails to load
              e.target.style.display = 'none';
              const fallback = e.target.nextElementSibling;
              if (fallback) {
                fallback.style.display = 'flex';
              }
            }}
          />
          <div className="hidden absolute inset-0 bg-gradient-to-br from-primary-500 to-secondary-500 items-center justify-center">
            <Calendar className="text-white/30" size={64} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0"></div>
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-primary-600 dark:text-primary-400">
              {event.priceCents === 0 ? 'FREE' : `₹${(event.priceCents / 100).toFixed(0)}`}
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
            {event.title}
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg mr-3">
                <Calendar size={16} className="text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-sm font-medium">{format(new Date(event.startTime), 'PPP')}</span>
            </div>
            
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <div className="bg-secondary-100 dark:bg-secondary-900/30 p-2 rounded-lg mr-3">
                <MapPin size={16} className="text-secondary-600 dark:text-secondary-400" />
              </div>
              <span className="text-sm font-medium line-clamp-1">{event.location}</span>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="w-full bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white py-3 rounded-xl font-semibold text-center group-hover:shadow-lg transition-all">
              View Details →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
