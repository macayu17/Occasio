import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, Mail, Calendar, Download, Share2, ArrowRight } from 'lucide-react';
import ShareButtons from '../../components/ShareButtons';

// Get API URL with fallback
const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SuccessPage() {
  const { state } = useLocation();

  return (
    <div className="min-h-screen z-10 font-['Outfit'] flex items-center justify-center p-4">
      {/* Container - removed solid bg, added fade-in */}
      <div className="max-w-xl w-full animate-scale-in">

        <div className="glass-card bg-[#18181b]/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-2xl relative overflow-hidden group">
          {/* Subtle noise texture overlay if desired, or just keep it clean glass */}
          <div className="absolute inset-0 bg-white/5 opacity-50 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.05%22/%3E%3C/svg%3E")' }}></div>

          {/* Success Icon with Glow */}
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full"></div>
            <div className="relative bg-emerald-500/10 p-4 rounded-full border border-emerald-500/20">
              <CheckCircle size={48} className="text-emerald-400" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Registration Successful!
          </h1>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            You are ready to go! We've sent the details to your email.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left relative z-10 transition-colors hover:bg-white/10">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1">Check your email</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We've sent your event ticket to your registered email address.
                  Please check your inbox (and spam folder) for the ticket with QR code.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state?.eventId && (
                <a
                  href={`/api/events/${state.eventId}/calendar`}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-all hover:scale-[1.02]"
                >
                  <Calendar size={18} />
                  <span>Add to Calendar</span>
                </a>
              )}

              {state?.orderId && (
                <a
                  href={`${API_URL}/tickets/order/${state.orderId}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-all hover:scale-[1.02]"
                >
                  <Download size={18} />
                  <span>Download Ticket</span>
                </a>
              )}
            </div>

            <Link to="/" className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-[#E23744] hover:bg-[#d12c39] text-white font-bold text-lg shadow-lg shadow-[#E23744]/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
              Browse More Events
              <ArrowRight size={20} />
            </Link>
          </div>

          {/* Share Section */}
          <div className="mt-8 pt-8 border-t border-white/10 relative z-10">
            <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-widest">
              Share this event with friends
            </p>
            <div className="flex justify-center opacity-80 hover:opacity-100 transition-opacity">
              <ShareButtons
                title="Just booked my ticket! Check out this event"
                url={state?.eventId ? `${window.location.origin}/events/${state.eventId}` : window.location.origin}
              />
            </div>
          </div>

        </div>

        <p className="text-center text-gray-500 text-xs mt-8">
          Need help? Contact us at <a href="mailto:support@occasio.com" className="text-gray-400 hover:text-white underline decoration-gray-600 underline-offset-4">support@occasio.com</a>
        </p>

      </div>
    </div>
  );
}

