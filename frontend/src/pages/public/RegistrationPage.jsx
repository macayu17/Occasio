import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { IndianRupee, Loader2, User, Mail, Phone, Tag, CreditCard, CheckCircle2, Ticket } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function RegistrationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState([]);
  const [selectedTier, setSelectedTier] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountMsg, setDiscountMsg] = useState('');
  const [paymentGateway, setPaymentGateway] = useState('RAZORPAY'); // RAZORPAY or PHONEPE

  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    fetchEventAndForm();
  }, [id]);

  const fetchEventAndForm = async () => {
    try {
      const [eventRes, formRes, tiersRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/form`),
        api.get(`/events/${id}/tiers`).catch(() => ({ data: [] }))
      ]);

      setEvent(eventRes.data);
      setForm(formRes.data);
      setTiers(tiersRes.data || []);
      // Auto-select first tier if available
      if (tiersRes.data && tiersRes.data.length > 0) {
        setSelectedTier(tiersRes.data[0]);
      }
    } catch (error) {
      console.error('Error fetching event/form:', error);
      const errorMessage = error.response?.data?.error || 'Failed to load registration form';
      toast.error(errorMessage);
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
    // Use tier price if selected, otherwise event base price
    const basePrice = selectedTier ? selectedTier.priceCents : event.priceCents;
    if (!appliedDiscount) return basePrice / 100;

    let original = basePrice / 100;
    if (appliedDiscount.type === 'PERCENTAGE') {
      return Math.max(0, original * (1 - appliedDiscount.amount / 100));
    } else {
      return Math.max(0, original - appliedDiscount.amount);
    }
  };

  const onSubmit = async (data) => {
    setSubmitting(true);

    try {
      const regResponse = await api.post(`/events/${id}/register`, {
        formResponse: data,
        discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        paymentGateway: paymentGateway,
        tierId: selectedTier?.id
      });

      const { order, requiresPayment } = regResponse.data;

      if (!requiresPayment) {
        toast.success('Registration successful!');
        navigate('/success', { state: { eventId: event.id, orderId: order.id } });
        return;
      }

      const checkoutResponse = await api.post(
        `/orders/${order.id}/create-checkout-session`
      );

      const checkoutData = checkoutResponse.data;

      if (checkoutData.provider === 'PHONEPE') {
        window.location.href = checkoutData.paymentUrl;
        return;
      }

      const { orderId, amount, currency, keyId } = checkoutData;

      if (typeof window.Razorpay === 'undefined') {
        toast.error('Payment gateway not loaded. Please refresh the page.');
        return;
      }

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

  if (processingPayment) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl">
        <div className="bg-[#18181b] border border-white/10 p-10 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#E23744]/20 rounded-full blur-[50px] pointer-events-none" />
          <div className="relative mb-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-t-2 border-[#E23744] animate-spin" />
              <div className="w-10 h-10 rounded-full bg-[#E23744] flex items-center justify-center shadow-[0_0_20px_rgba(226,55,68,0.5)]">
                <IndianRupee className="text-white" size={20} />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 font-display">Processing Payment</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Please wait while we securely process your transaction...
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
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white py-8 relative overflow-hidden font-['Outfit']">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#E23744]/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-lg mx-auto px-4 relative z-10">
        <div className="glass-card bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">

          <div className="text-center mb-6 pb-4 border-b border-white/5">
            <h1 className="text-2xl font-bold mb-2 text-white tracking-tight">{event.title}</h1>
            <p className="text-gray-400 text-sm">Complete your registration</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Section: Personal Details */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <User size={16} className="text-[#E23744]" />
                Personal Details
              </h3>

              <div className="grid gap-3">
                {form.schemaJson.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                      {field.label} {field.required && <span className="text-[#E23744]">*</span>}
                    </label>

                    <div className="relative group">
                      {field.type === 'select' ? (
                        <>
                          <select
                            {...register(field.key, { required: field.required })}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#E23744] focus:ring-1 focus:ring-[#E23744] transition-all appearance-none"
                          >
                            <option value="">Select an option</option>
                            {field.options.map((option) => (
                              <option key={option} value={option} className="bg-[#18181b]">{option}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </div>
                        </>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          {...register(field.key, { required: field.required })}
                          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#E23744] focus:ring-1 focus:ring-[#E23744] transition-all resize-none min-h-[80px]"
                          placeholder={`Enter your ${field.label.toLowerCase()}...`}
                        />
                      ) : (
                        <div className="relative">
                          <input
                            type={field.type}
                            {...register(field.key, { required: field.required })}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#E23744] focus:ring-1 focus:ring-[#E23744] transition-all"
                            placeholder={`Enter your ${field.label.toLowerCase()}`}
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            {field.label.toLowerCase().includes('email') ? <Mail size={14} /> :
                              field.label.toLowerCase().includes('phone') ? <Phone size={14} /> :
                                <User size={14} />}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors[field.key] && (
                      <p className="text-[#E23744] text-xs ml-1 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#E23744]" /> This field is required
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Ticket Tier (only show if tiers exist) */}
            {tiers.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Ticket size={16} className="text-[#E23744]" />
                  Select Ticket Type
                </h3>

                <div className="grid gap-2">
                  {tiers.map((tier) => (
                    <label
                      key={tier.id}
                      className={`relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${selectedTier?.id === tier.id
                        ? 'bg-[#E23744]/10 border-[#E23744] shadow-[0_0_15px_rgba(226,55,68,0.1)]'
                        : 'bg-black/20 border-white/10 hover:border-white/20 hover:bg-white/5'
                        }`}
                    >
                      <input
                        type="radio"
                        name="ticketTier"
                        value={tier.id}
                        className="sr-only"
                        onChange={() => setSelectedTier(tier)}
                        checked={selectedTier?.id === tier.id}
                      />

                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${selectedTier?.id === tier.id ? 'border-[#E23744]' : 'border-gray-500'
                        }`}>
                        {selectedTier?.id === tier.id && <div className="w-2 h-2 rounded-full bg-[#E23744]" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-medium text-sm truncate ${selectedTier?.id === tier.id ? 'text-white' : 'text-gray-300'}`}>
                            {tier.name}
                          </span>
                          <span className="text-sm font-bold text-[#E23744] flex-shrink-0">
                            ₹{(tier.priceCents / 100).toFixed(0)}
                          </span>
                        </div>
                        {tier.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{tier.description}</p>
                        )}
                        {tier.capacity && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {tier.capacity - tier.soldCount} remaining
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Section: Payment */}
            {(selectedTier ? selectedTier.priceCents > 0 : event.priceCents > 0) && (
              <div className="space-y-5 pt-5 border-t border-white/5">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <CreditCard size={16} className="text-[#E23744]" />
                  Payment
                </h3>

                {/* Amount Card */}
                <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-6 rounded-2xl flex justify-between items-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#E23744]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none transition-opacity group-hover:opacity-100 opacity-50" />
                  <div>
                    <span className="block text-sm text-gray-400 font-medium mb-1">Total Amount</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white tracking-tight">
                        {calculateTotal() === 0 ? 'Free' : `${event.currency} ${calculateTotal().toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Promo Code */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                    <Tag size={12} /> Promo Code
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-4 pr-4 py-3 text-white placeholder-gray-600 focus:border-[#E23744] transition-all uppercase tracking-widest text-sm font-mono"
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
                        className="px-6 rounded-xl bg-white/10 text-white border border-white/10 hover:bg-white/20 transition-all font-medium text-sm">
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

                {/* Payment Gateway Selector */}
                {calculateTotal() > 0 && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Payment Gateway</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                      {/* Razorpay Option */}
                      <label className={`relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 group overflow-hidden ${paymentGateway === 'RAZORPAY'
                        ? 'bg-[#E23744]/5 border-[#E23744] shadow-[0_0_20px_rgba(226,55,68,0.1)]'
                        : 'bg-black/20 border-white/10 hover:border-white/20 hover:bg-white/5'
                        }`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${paymentGateway === 'RAZORPAY' ? 'bg-[#E23744]' : 'bg-transparent'}`} />

                        <input type="radio" name="paymentGateway" value="RAZORPAY" className="sr-only" onChange={(e) => setPaymentGateway(e.target.value)} checked={paymentGateway === 'RAZORPAY'} />

                        <div className="p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
                          <img src="/razorpay-logo.png" alt="Razorpay" className="w-6 h-6 object-contain" />
                        </div>
                        <div className="flex-1">
                          <span className={`block font-medium transition-colors ${paymentGateway === 'RAZORPAY' ? 'text-white' : 'text-gray-300'}`}>Razorpay</span>
                          <span className="text-xs text-gray-500">Cards, UPI, Netbanking</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${paymentGateway === 'RAZORPAY' ? 'border-[#E23744]' : 'border-gray-600'}`}>
                          {paymentGateway === 'RAZORPAY' && <div className="w-2.5 h-2.5 rounded-full bg-[#E23744]" />}
                        </div>
                      </label>

                      {/* PhonePe Option */}
                      <label className={`relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 group overflow-hidden ${paymentGateway === 'PHONEPE'
                        ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                        : 'bg-black/20 border-white/10 hover:border-white/20 hover:bg-white/5'
                        }`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${paymentGateway === 'PHONEPE' ? 'bg-purple-500' : 'bg-transparent'}`} />

                        <input type="radio" name="paymentGateway" value="PHONEPE" className="sr-only" onChange={(e) => setPaymentGateway(e.target.value)} checked={paymentGateway === 'PHONEPE'} />

                        <div className="p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
                          <img src="/phonepe-logo.png" alt="PhonePe" className="w-6 h-6 object-contain" />
                        </div>
                        <div className="flex-1">
                          <span className={`block font-medium transition-colors ${paymentGateway === 'PHONEPE' ? 'text-white' : 'text-gray-300'}`}>PhonePe</span>
                          <span className="text-xs text-gray-500">UPI, Wallet, Cards</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${paymentGateway === 'PHONEPE' ? 'border-purple-500' : 'border-gray-600'}`}>
                          {paymentGateway === 'PHONEPE' && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                        </div>
                      </label>

                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 px-6 bg-[#E23744] hover:bg-[#d42d3a] text-white rounded-xl font-semibold text-lg shadow-lg shadow-[#E23744]/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-8 flex items-center justify-center gap-3"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>
                    {calculateTotal() === 0 ? 'Complete Registration' : `Pay ${event.currency} ${calculateTotal().toFixed(2)}`}
                  </span>
                  {calculateTotal() > 0 && <span className="opacity-50">→</span>}
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer info/trust signals could go here */}
        <p className="text-center text-gray-500 text-xs mt-8">
          Secure payment processing • 256-bit SSL Encrypted
        </p>

      </div>
    </div>
  );
}
