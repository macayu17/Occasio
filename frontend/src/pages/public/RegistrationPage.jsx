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

  const onSubmit = async (data) => {
    setSubmitting(true);
    
    try {
      // Register for event
      const regResponse = await api.post(`/events/${id}/register`, {
        formResponse: data
      });

      const { order, requiresPayment } = regResponse.data;

      if (!requiresPayment) {
        toast.success('Registration successful!');
        navigate('/success');
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
          try {
            // Verify payment on backend
            await api.post(`/orders/${order.id}/verify-payment`, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
            
            toast.success('Payment successful! Check your email for the ticket.');
            navigate('/success');
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment completed but verification failed. Please contact support.');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Registration form not available</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
          <p className="text-gray-600 mb-8">Please fill in your details to register</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {form.schemaJson.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <p className="text-red-500 text-sm mt-1">This field is required</p>
                )}
              </div>
            ))}

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Amount:</span>
                <span className="text-2xl font-bold text-primary-600">
                  {event.priceCents === 0
                    ? 'Free'
                    : `${event.currency} ${(event.priceCents / 100).toFixed(2)}`}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full py-3 text-lg disabled:opacity-50"
            >
              {submitting ? 'Processing...' : event.priceCents === 0 ? 'Register' : 'Proceed to Payment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
