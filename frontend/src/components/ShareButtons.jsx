import { Share2, Link, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShareButtons({ title, url, description }) {
    const shareUrl = url || window.location.href;
    const shareTitle = title || 'Check out this event!';
    const shareText = description || shareTitle;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard!');
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    const handleWebShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        }
    };

    const shareToWhatsApp = () => {
        const text = encodeURIComponent(`${shareTitle}\n${shareUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const shareToTwitter = () => {
        const text = encodeURIComponent(shareTitle);
        const urlEncoded = encodeURIComponent(shareUrl);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${urlEncoded}`, '_blank');
    };

    const shareToFacebook = () => {
        const urlEncoded = encodeURIComponent(shareUrl);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`, '_blank');
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Web Share API (mobile-friendly) */}
            {navigator.share && (
                <button
                    onClick={handleWebShare}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Share"
                >
                    <Share2 size={18} />
                    <span className="text-sm font-medium">Share</span>
                </button>
            )}

            {/* WhatsApp */}
            <button
                onClick={shareToWhatsApp}
                className="flex items-center justify-center w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                title="Share on WhatsApp"
            >
                <MessageCircle size={20} />
            </button>

            {/* Twitter/X */}
            <button
                onClick={shareToTwitter}
                className="flex items-center justify-center w-10 h-10 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors"
                title="Share on X (Twitter)"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
            </button>

            {/* Facebook */}
            <button
                onClick={shareToFacebook}
                className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Share on Facebook"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
            </button>

            {/* Copy Link */}
            <button
                onClick={handleCopyLink}
                className="flex items-center justify-center w-10 h-10 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                title="Copy Link"
            >
                <Link size={20} />
            </button>
        </div>
    );
}
