import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api, { getImageUrl } from '../../utils/api';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { format } from 'date-fns';

export default function EditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/events/${id}`);
      const event = response.data;

      reset({
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm"),
        endTime: format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm"),
        capacity: event.capacity,
        price: event.priceCents / 100
      });

      if (event.posterUrl) {
        setPosterPreview(getImageUrl(event.posterUrl));
      }
    } catch (error) {
      toast.error('Failed to fetch event');
      navigate('/admin/events');
    } finally {
      setFetchLoading(false);
    }
  };

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
      // Update event
      const eventData = {
        ...data,
        priceCents: Math.round(parseFloat(data.price) * 100),
        capacity: parseInt(data.capacity)
      };
      delete eventData.price;

      await api.put(`/admin/events/${id}`, eventData);

      // Upload new poster if selected
      if (posterFile) {
        const formData = new FormData();
        formData.append('poster', posterFile);

        await api.post(`/admin/events/${id}/poster-upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Event updated successfully!');
      navigate('/admin/events');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update event');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Edit Event</h1>

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
            {loading ? 'Saving...' : 'Save Changes'}
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
