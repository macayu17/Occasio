import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function PhonePeCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // verifying, success, failed, pending
    const [retryCount, setRetryCount] = useState(0);

    const orderId = searchParams.get('orderId');

    useEffect(() => {
        if (orderId) {
            verifyPayment();
        } else {
            setStatus('failed');
            toast.error('Invalid payment callback');
        }
    }, [orderId]);

    const verifyPayment = async () => {
        try {
            setStatus('verifying');
            const response = await api.post(`/orders/${orderId}/verify-phonepe`);

            if (response.data.success) {
                setStatus('success');
                toast.success('Payment successful! Check your email for the ticket.');
                setTimeout(() => {
                    navigate('/success', {
                        state: {
                            orderId,
                            eventId: response.data.eventId
                        }
                    });
                }, 2000);
            } else if (response.data.state === 'PENDING') {
                setStatus('pending');
            } else {
                setStatus('failed');
            }
        } catch (error) {
            console.error('PhonePe verification error:', error);
            if (error.response?.status === 202) {
                setStatus('pending');
            } else {
                setStatus('failed');
                toast.error('Payment verification failed');
            }
        }
    };

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        verifyPayment();
    };

    return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#E23744]/10 rounded-full blur-[100px]" />
            </div>

            <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-10 max-w-md w-full text-center relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] pointer-events-none" />

                {status === 'verifying' && (
                    <>
                        <div className="relative mb-8">
                            <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center relative">
                                <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin" />
                                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Verifying Payment</h2>
                        <p className="text-gray-400 mb-4">
                            Please wait while we confirm your PhonePe payment...
                        </p>
                        <p className="text-xs text-gray-500 animate-pulse">
                            Do not close this page
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="relative mb-8">
                            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircle className="w-12 h-12 text-emerald-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
                        <p className="text-gray-400 mb-4">
                            Redirecting you to download your ticket...
                        </p>
                    </>
                )}

                {status === 'pending' && (
                    <>
                        <div className="relative mb-8">
                            <div className="w-20 h-20 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                                <RefreshCw className="w-12 h-12 text-yellow-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Payment Pending</h2>
                        <p className="text-gray-400 mb-6">
                            Your payment is still being processed. This may take a few moments.
                        </p>
                        <button
                            onClick={handleRetry}
                            disabled={retryCount >= 5}
                            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                        >
                            {retryCount >= 5 ? 'Please contact support' : 'Check Again'}
                        </button>
                    </>
                )}

                {status === 'failed' && (
                    <>
                        <div className="relative mb-8">
                            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                                <XCircle className="w-12 h-12 text-red-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Payment Failed</h2>
                        <p className="text-gray-400 mb-6">
                            Unfortunately, your payment could not be verified. Please try again or contact support.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => navigate(-2)}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-medium transition-all"
                            >
                                Go Back
                            </button>
                            <button
                                onClick={handleRetry}
                                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-all"
                            >
                                Retry
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
