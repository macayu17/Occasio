import { Share2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ShareButton({ event, url, title, description }) {
  const [showMenu, setShowMenu] = useState(false);

  // Support both event object and separate props
  const shareUrl = url || (event ? `${window.location.origin}/events/${event.id}` : window.location.href);
  const shareTitle = title || event?.title || '';
  const shareDescription = description || event?.description || '';
  const shareText = `Check out ${shareTitle}${shareDescription ? ' - ' + shareDescription.substring(0, 100) + '...' : ''}`;

  const handleShare = async (platform) => {
    setShowMenu(false);

    if (platform === 'native' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
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

    let openUrl = '';
    switch (platform) {
      case 'facebook':
        openUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        openUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
      case 'linkedin':
        openUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        openUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
      case 'email':
        openUrl = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
        return;
    }

    if (openUrl) {
      window.open(openUrl, '_blank', 'width=600,height=400');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
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
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-2">
            {navigator.share && (
              <button
                onClick={() => handleShare('native')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              >
                📱 Share via...
              </button>
            )}
            <button
              onClick={() => handleShare('facebook')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              📘 Facebook
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              🐦 Twitter
            </button>
            <button
              onClick={() => handleShare('linkedin')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              💼 LinkedIn
            </button>
            <button
              onClick={() => handleShare('whatsapp')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              💬 WhatsApp
            </button>
            <button
              onClick={() => handleShare('email')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              📧 Email
            </button>
            <hr className="my-2 border-gray-200 dark:border-gray-700" />
            <button
              onClick={() => handleShare('copy')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-primary-600 dark:text-primary-400 transition-colors"
            >
              🔗 Copy Link
            </button>
          </div>
        </>
      )}
    </div>
  );
}
