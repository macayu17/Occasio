import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function RegistrationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountMsg, setDiscountMsg] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    fetchEventAndForm();
  }, [id]);

  const fetchEventAndForm = async () => {
    try {
      const [eventRes, formRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/form`)
      ]);

      setEvent(eventRes.data);
      setForm(formRes.data);
    } catch (error) {
      console.error('Error fetching event/form:', error);
      const errorMessage = error.response?.data?.error || 'Failed to load registration form';
      toast.error(errorMessage);
      // Don't navigate away immediately, let user see the error
      setTimeout(() => {
        navigate(`/events/${id}`);
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDiscount = async () => {
    if (!discountCode) return;
    try {
      const res = await api.post('/discounts/validate', {
        eventId: id,
        code: discountCode
      });
      setAppliedDiscount(res.data);
      setDiscountMsg({ type: 'success', text: `Applied: ${res.data.code}` });
    } catch (error) {
      setAppliedDiscount(null);
      setDiscountMsg({ type: 'error', text: error.response?.data?.error || 'Invalid code' });
    }
  };

  const calculateTotal = () => {
    if (!event) return 0;
    if (!appliedDiscount) return event.priceCents / 100;

    let original = event.priceCents / 100;
    if (appliedDiscount.type === 'PERCENTAGE') {
      return Math.max(0, original * (1 - appliedDiscount.amount / 100));
    } else {
      return Math.max(0, original - appliedDiscount.amount);
    }
  };

  const onSubmit = async (data) => {
    setSubmitting(true);

    try {
      // Register for event
      const regResponse = await api.post(`/events/${id}/register`, {
        formResponse: data,
        discountCode: appliedDiscount ? appliedDiscount.code : undefined
      });

      const { order, requiresPayment } = regResponse.data;

      if (!requiresPayment) {
        toast.success('Registration successful!');
        navigate('/success', { state: { eventId: event.id, orderId: order.id } });
        return;
      }

      // Create checkout session
      const checkoutResponse = await api.post(
        `/orders/${order.id}/create-checkout-session`
      );

      const { orderId, amount, currency, keyId } = checkoutResponse.data;

      // Check if Razorpay is loaded
      if (typeof window.Razorpay === 'undefined') {
        toast.error('Payment gateway not loaded. Please refresh the page.');
        return;
      }

      // Initialize Razorpay
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: event.title,
        description: 'Event Registration',
        order_id: orderId,
        handler: async function (response) {
          setProcessingPayment(true);
          try {
            // Verify payment on backend
            await api.post(`/orders/${order.id}/verify-payment`, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });

            toast.success('Payment successful! Check your email for the ticket.');
            navigate('/success', { state: { eventId: event.id, orderId: order.id } });
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment completed but verification failed. Please contact support.');
            setProcessingPayment(false);
          }
        },
        prefill: {
          name: data.name,
          email: data.email,
          contact: data.phone || ''
        },
        theme: {
          color: '#667eea'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

      razorpay.on('payment.failed', function () {
        toast.error('Payment failed. Please try again.');
      });
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Registration failed';
      console.error('Error details:', error.response?.data);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 dark:border-primary-900"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-600 absolute top-0"></div>
        </div>
      </div>
    );
  }

  // Processing Payment Overlay
  if (processingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center p-8">
          {/* Simple Spinner */}
          <div className="mb-8">
            <div className="w-16 h-16 mx-auto border-4 border-gray-700 border-t-primary-500 rounded-full animate-spin"></div>
          </div>

          {/* Status Text */}
          <h2 className="text-2xl font-bold text-white mb-3">Processing Your Payment</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Please wait while we confirm your payment and generate your ticket.
          </p>

          {/* Progress Steps */}
          <div className="flex flex-col items-start max-w-xs mx-auto space-y-3 text-left">
            <div className="flex items-center text-green-400">
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Payment received</span>
            </div>
            <div className="flex items-center text-primary-400">
              <div className="w-5 h-5 mr-3 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse"></div>
              </div>
              <span className="text-sm">Verifying transaction...</span>
            </div>
            <div className="flex items-center text-gray-500">
              <div className="w-5 h-5 mr-3 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              </div>
              <span className="text-sm">Generating your ticket</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-8">
            Do not close or refresh this page
          </p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Registration form not available</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <h1 className="text-3xl font-bold mb-2 gradient-text">{event.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Please fill in your details to register</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {form.schemaJson.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    {...register(field.key, { required: field.required })}
                    className="input"
                  >
                    <option value="">Select...</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    {...register(field.key, { required: field.required })}
                    className="input"
                    rows={4}
                  />
                ) : (
                  <input
                    type={field.type}
                    {...register(field.key, { required: field.required })}
                    className="input"
                  />
                )}

                {errors[field.key] && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1">This field is required</p>
                )}
              </div>
            ))}

            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 p-6 rounded-xl border border-primary-200 dark:border-primary-800">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-white">Total Amount:</span>
                <span className="text-3xl font-bold gradient-text">
                  {calculateTotal() === 0
                    ? 'Free'
                    : `${event.currency} ${calculateTotal().toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Discount Code Section */}
            {event.priceCents > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Promo Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    className="input flex-1 uppercase"
                    placeholder="ENTER CODE"
                    disabled={!!appliedDiscount}
                  />
                  {appliedDiscount ? (
                    <button type="button" onClick={() => { setAppliedDiscount(null); setDiscountCode(''); setDiscountMsg(''); }} className="btn btn-secondary text-red-500">
                      Remove
                    </button>
                  ) : (
                    <button type="button" onClick={handleApplyDiscount} className="btn btn-secondary">
                      Apply
                    </button>
                  )}
                </div>
                {discountMsg && (
                  <p className={`text-sm ${discountMsg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                    {discountMsg.text}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (calculateTotal() === 0 ? 'Register Free' : `Proceed to Payment`)}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
