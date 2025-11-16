import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);

  const handlePosterChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPosterFile(file);
      setPosterPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);

    try {
      // Create event
      const eventData = {
        ...data,
        priceCents: Math.round(parseFloat(data.price) * 100),
        capacity: parseInt(data.capacity)
      };
      delete eventData.price;

      const response = await api.post('/admin/events', eventData);
      const event = response.data;

      // Upload poster if selected
      if (posterFile) {
        const formData = new FormData();
        formData.append('poster', posterFile);

        await api.post(`/admin/events/${event.id}/poster-upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Event created successfully!');
      navigate('/admin/events');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Create New Event</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Event Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Title *
              </label>
              <input
                type="text"
                {...register('title', { required: true })}
                className="input"
                placeholder="Annual Tech Conference 2024"
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">Title is required</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                {...register('description', { required: true })}
                className="input"
                rows={5}
                placeholder="Describe your event..."
              />
              {errors.description && <p className="text-red-500 text-sm mt-1">Description is required</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <input
                type="text"
                {...register('location', { required: true })}
                className="input"
                placeholder="Convention Center, New York"
              />
              {errors.location && <p className="text-red-500 text-sm mt-1">Location is required</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date & Time *
                </label>
                <input
                  type="datetime-local"
                  {...register('startTime', { required: true })}
                  className="input"
                />
                {errors.startTime && <p className="text-red-500 text-sm mt-1">Start time is required</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date & Time *
                </label>
                <input
                  type="datetime-local"
                  {...register('endTime', { required: true })}
                  className="input"
                />
                {errors.endTime && <p className="text-red-500 text-sm mt-1">End time is required</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity *
                </label>
                <input
                  type="number"
                  {...register('capacity', { required: true, min: 1 })}
                  className="input"
                  placeholder="100"
                />
                {errors.capacity && <p className="text-red-500 text-sm mt-1">Valid capacity is required</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('price', { min: 0 })}
                  className="input"
                  placeholder="0.00 (Free)"
                  defaultValue="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Poster
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {posterPreview ? (
                  <div className="space-y-4">
                    <img
                      src={posterPreview}
                      alt="Poster preview"
                      className="max-h-64 mx-auto rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPosterFile(null);
                        setPosterPreview(null);
                      }}
                      className="btn btn-secondary"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload poster image</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePosterChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/events')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
