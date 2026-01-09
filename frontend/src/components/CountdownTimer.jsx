import { useState, useEffect } from 'react';

export default function CountdownTimer({ targetDate, label = "Registration closes in" }) {
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    function calculateTimeLeft() {
        const difference = new Date(targetDate) - new Date();

        if (difference <= 0) {
            return null;
        }

        return {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / 1000 / 60) % 60),
            seconds: Math.floor((difference / 1000) % 60)
        };
    }

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    if (!timeLeft) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                <span className="text-red-600 dark:text-red-400 font-medium">Registration closed</span>
            </div>
        );
    }

    const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;

    return (
        <div className={`rounded-xl p-4 ${isUrgent ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' : 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'}`}>
            <p className={`text-sm font-medium mb-2 text-center ${isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-primary-600 dark:text-primary-400'}`}>
                {label}
            </p>
            <div className="flex justify-center gap-3">
                {timeLeft.days > 0 && (
                    <div className="text-center">
                        <div className={`text-2xl font-bold ${isUrgent ? 'text-orange-700 dark:text-orange-300' : 'text-primary-700 dark:text-primary-300'}`}>
                            {timeLeft.days}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">days</div>
                    </div>
                )}
                <div className="text-center">
                    <div className={`text-2xl font-bold ${isUrgent ? 'text-orange-700 dark:text-orange-300' : 'text-primary-700 dark:text-primary-300'}`}>
                        {String(timeLeft.hours).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">hours</div>
                </div>
                <div className="text-center">
                    <div className={`text-2xl font-bold ${isUrgent ? 'text-orange-700 dark:text-orange-300' : 'text-primary-700 dark:text-primary-300'}`}>
                        {String(timeLeft.minutes).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">min</div>
                </div>
                <div className="text-center">
                    <div className={`text-2xl font-bold ${isUrgent ? 'text-orange-700 dark:text-orange-300' : 'text-primary-700 dark:text-primary-300'}`}>
                        {String(timeLeft.seconds).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">sec</div>
                </div>
            </div>
            {isUrgent && (
                <p className="text-xs text-orange-600 dark:text-orange-400 text-center mt-2 animate-pulse">
                    ⚡ Hurry! Limited time remaining
                </p>
            )}
        </div>
    );
}
