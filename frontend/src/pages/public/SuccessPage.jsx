import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, Mail, Calendar, Download, Share2 } from 'lucide-react';
import ShareButtons from '../../components/ShareButtons';

// Get API URL with fallback
const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SuccessPage() {
  const { state } = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-6">
            <CheckCircle size={64} className="text-green-500" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Registration Successful!
          </h1>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Mail className="text-blue-500 mt-1 mr-3" size={20} />
              <div className="text-left">
                <p className="text-sm font-medium text-blue-900">
                  Check your email
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  We've sent your event ticket to your registered email address.
                  Please check your inbox (and spam folder) for the ticket with QR code.
                </p>
              </div>
            </div>
          </div>

          <p className="text-gray-600 mb-8">
            Please save your ticket and present the QR code at the venue entrance.
          </p>

          <div className="space-y-3">
            {state?.eventId && (
              <a
                href={`/api/events/${state.eventId}/calendar`}
                className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Calendar size={20} />
                Add to Calendar
              </a>
            )}

            {state?.orderId && (
              <a
                href={`${API_URL}/tickets/order/${state.orderId}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 font-medium shadow-lg shadow-gray-200"
              >
                <Download size={20} />
                Download Ticket
              </a>
            )}
            <Link to="/" className="btn btn-primary w-full">
              Browse More Events
            </Link>
          </div>

          {/* Share Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4 flex items-center justify-center gap-2">
              <Share2 size={16} />
              Share this event with friends
            </p>
            <div className="flex justify-center">
              <ShareButtons
                title="Just booked my ticket! Check out this event"
                url={state?.eventId ? `${window.location.origin}/events/${state.eventId}` : window.location.origin}
              />
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Need help? Contact us at support@eventmanagement.com
          </p>
        </div>
      </div>
    </div>
  );
}

