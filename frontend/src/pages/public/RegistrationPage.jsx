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
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-white/10"></div>
          <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-t-4 border-[#E23744] animate-spin"></div>
        </div>
      </div>
    );
  }

  // Processing Payment Overlay
  if (processingPayment) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl">
        <div className="bg-[#18181b] border border-white/10 p-10 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#E23744]/20 rounded-full blur-[50px] pointer-events-none" />

          {/* Icon */}
          <div className="relative mb-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-t-2 border-[#E23744] animate-spin" />
              <div className="w-10 h-10 rounded-full bg-[#E23744] flex items-center justify-center shadow-[0_0_20px_rgba(226,55,68,0.5)]">
                <DollarSign className="text-white" size={20} />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 font-display">Processing Payment</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Please wait while we securely process your transaction and generate your ticket.
          </p>

          {/* Steps */}
          <div className="space-y-4 text-left bg-white/5 rounded-xl p-6 border border-white/5">
            <div className="flex items-center gap-3 text-[#E23744]">
              <div className="w-5 h-5 rounded-full bg-[#E23744]/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#E23744]" />
              </div>
              <span className="text-sm font-medium">Payment received</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <Loader2 className="animate-spin text-[#E23744]" size={16} />
              <span className="text-sm font-medium">Verifying transaction...</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-4 h-4 rounded-full border border-gray-600 ml-0.5" />
              <span className="text-sm">Generating Ticket</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-6 animate-pulse">
            Please do not close or refresh this page
          </p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <h2 className="text-xl font-medium text-white mb-4">Registration form not available</h2>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white py-12 relative overflow-hidden font-['Inter']">
      {/* Ambient Backgroud */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#E23744]/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="glass-card bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-3 text-white tracking-tight">{event.title}</h1>
            <p className="text-gray-400 text-sm">Please fill in your details below to register</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {form.schemaJson.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                  {field.label}
                  {field.required && <span className="text-[#E23744] ml-1">*</span>}
                </label>

                {field.type === 'select' ? (
                  <div className="relative">
                    <select
                      {...register(field.key, { required: field.required })}
                      className="w-full bg-[#09090b]/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#E23744]/50 focus:ring-1 focus:ring-[#E23744]/50 transition-all appearance-none"
                    >
                      <option value="">Select an option</option>
                      {field.options.map((option) => (
                        <option key={option} value={option} className="bg-[#18181b]">
                          {option}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                ) : field.type === 'textarea' ? (
                  <textarea
                    {...register(field.key, { required: field.required })}
                    className="w-full bg-[#09090b]/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E23744]/50 focus:ring-1 focus:ring-[#E23744]/50 transition-all resize-none min-h-[100px]"
                    placeholder={`Enter your ${field.label.toLowerCase()}...`}
                  />
                ) : (
                  <input
                    type={field.type}
                    {...register(field.key, { required: field.required })}
                    className="w-full bg-[#09090b]/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#E23744]/50 focus:ring-1 focus:ring-[#E23744]/50 transition-all"
                    placeholder={`Enter your ${field.label.toLowerCase()}`}
                  />
                )}

                {errors[field.key] && (
                  <p className="text-[#E23744] text-xs ml-1 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#E23744]" />
                    This field is required
                  </p>
                )}
              </div>
            ))}

            <div className="mt-8 pt-8 border-t border-white/5 space-y-6">
              {/* Total Display */}
              <div className="bg-white/5 border border-white/5 p-6 rounded-2xl flex justify-between items-center group hover:bg-white/[0.07] transition-colors">
                <span className="font-medium text-gray-300">Total Amount</span>
                <span className="text-3xl font-bold text-white tracking-tight">
                  {calculateTotal() === 0
                    ? 'Free'
                    : `${event.currency} ${calculateTotal().toFixed(2)}`}
                </span>
              </div>

              {/* Discount Code */}
              {event.priceCents > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Promo Code</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1 group">
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        className="w-full bg-[#09090b]/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#E23744]/50 transition-all uppercase tracking-widest text-sm font-mono group-hover:border-white/20"
                        placeholder="ENTER CODE"
                        disabled={!!appliedDiscount}
                      />
                    </div>

                    {appliedDiscount ? (
                      <button type="button" onClick={() => { setAppliedDiscount(null); setDiscountCode(''); setDiscountMsg(''); }}
                        className="px-5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all font-medium text-sm">
                        Remove
                      </button>
                    ) : (
                      <button type="button" onClick={handleApplyDiscount}
                        className="px-6 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-medium text-sm">
                        Apply
                      </button>
                    )}
                  </div>
                  {discountMsg && (
                    <p className={`text-xs ml-1 ${discountMsg.type === 'success' ? 'text-emerald-500' : 'text-[#E23744]'}`}>
                      {discountMsg.text}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 bg-[#E23744] hover:bg-[#d42d3a] text-white rounded-xl font-semibold text-lg shadow-lg shadow-[#E23744]/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Processing Setup...</span>
                  </>
                ) : (calculateTotal() === 0 ? 'Complete Registration' : `Proceed to Payment`)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
