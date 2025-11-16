import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, MapPin, DollarSign } from 'lucide-react';
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
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-500 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
              Discover Amazing Events
            </h1>
            <p className="text-xl mb-8 text-primary-100">
              Book tickets for concerts, workshops, conferences, and more
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search events..."
                  className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold mb-8">Upcoming Events</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No events found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventCard({ event }) {
  return (
    <Link to={`/events/${event.id}`} className="card hover:shadow-lg transition-shadow">
      {event.posterUrl && (
        <img
          src={event.posterUrl}
          alt={event.title}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
      )}
      
      <h3 className="text-xl font-bold mb-2">{event.title}</h3>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center">
          <Calendar size={16} className="mr-2" />
          <span>{format(new Date(event.startTime), 'PPP')}</span>
        </div>
        
        <div className="flex items-center">
          <MapPin size={16} className="mr-2" />
          <span>{event.location}</span>
        </div>
        
        <div className="flex items-center">
          <DollarSign size={16} className="mr-2" />
          <span>
            {event.priceCents === 0
              ? 'Free'
              : `${event.currency} ${(event.priceCents / 100).toFixed(2)}`}
          </span>
        </div>
      </div>
      
      <button className="btn btn-primary w-full mt-4">
        View Details
      </button>
    </Link>
  );
}
