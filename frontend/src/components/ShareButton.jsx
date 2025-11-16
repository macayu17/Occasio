import { Share2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ShareButton({ event }) {
  const [showMenu, setShowMenu] = useState(false);

  const shareUrl = `${window.location.origin}/events/${event.slug}`;
  const shareText = `Check out ${event.title} - ${event.description?.substring(0, 100)}...`;

  const handleShare = async (platform) => {
    setShowMenu(false);

    if (platform === 'native' && navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: shareText,
          url: shareUrl
        });
        toast.success('Shared successfully!');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
      return;
    }

    let url = '';
    switch (platform) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
        return;
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Share2 size={18} />
        <span>Share</span>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-20 py-2">
            {navigator.share && (
              <button
                onClick={() => handleShare('native')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
              >
                📱 Share via...
              </button>
            )}
            <button
              onClick={() => handleShare('facebook')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              📘 Facebook
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              🐦 Twitter
            </button>
            <button
              onClick={() => handleShare('linkedin')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              💼 LinkedIn
            </button>
            <button
              onClick={() => handleShare('whatsapp')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              💬 WhatsApp
            </button>
            <button
              onClick={() => handleShare('email')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              📧 Email
            </button>
            <hr className="my-2" />
            <button
              onClick={() => handleShare('copy')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors font-medium text-primary-600"
            >
              🔗 Copy Link
            </button>
          </div>
        </>
      )}
    </div>
  );
}
