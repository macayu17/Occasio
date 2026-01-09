import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check if push notifications are supported
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        setIsSupported(supported);

        if (supported) {
            checkSubscription();
        } else {
            setIsLoading(false);
        }
    }, []);

    const checkSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        } catch (err) {
            console.error('Error checking subscription:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const subscribe = useCallback(async (userEmail = null) => {
        if (!isSupported) {
            setError('Push notifications not supported');
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Get VAPID public key from server
            const { data } = await api.get('/push/vapid-key');
            const vapidPublicKey = data.publicKey;

            // Request notification permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setError('Notification permission denied');
                return false;
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // Send subscription to server
            await api.post('/push/subscribe', {
                subscription: subscription.toJSON(),
                userEmail
            });

            setIsSubscribed(true);
            return true;
        } catch (err) {
            console.error('Push subscription error:', err);
            setError(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    const unsubscribe = useCallback(async () => {
        if (!isSupported) return false;

        setIsLoading(true);
        setError(null);

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Unsubscribe locally
                await subscription.unsubscribe();

                // Notify server
                await api.post('/push/unsubscribe', {
                    endpoint: subscription.endpoint
                });
            }

            setIsSubscribed(false);
            return true;
        } catch (err) {
            console.error('Push unsubscribe error:', err);
            setError(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    return {
        isSupported,
        isSubscribed,
        isLoading,
        error,
        subscribe,
        unsubscribe
    };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default usePushNotifications;
