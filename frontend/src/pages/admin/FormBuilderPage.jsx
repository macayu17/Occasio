import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Text Area' }
];

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fields, setFields] = useState([
    { key: 'name', type: 'text', label: 'Full Name', required: true },
    { key: 'email', type: 'email', label: 'Email', required: true }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchForm();
  }, [id]);

  const fetchForm = async () => {
    try {
      const response = await api.get(`/events/${id}/form`);
      if (response.data?.schemaJson?.fields) {
        setFields(response.data.schemaJson.fields);
      }
    } catch (error) {
      // Form doesn't exist yet, use defaults
      console.log('No form found, using defaults');
    }
  };

  const addField = () => {
    setFields([
      ...fields,
      {
        key: `field_${Date.now()}`,
        type: 'text',
        label: 'New Field',
        required: false,
        options: []
      }
    ]);
  };

  const updateField = (index, updates) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const schemaJson = {
        title: 'Registration Form',
        fields: fields.map(field => ({
          ...field,
          options: field.type === 'select' ? field.options : undefined
        }))
      };

      await api.post(`/admin/events/${id}/form`, { schemaJson });
      toast.success('Form saved successfully!');
      navigate('/admin/events');
    } catch (error) {
      toast.error('Failed to save form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Form Builder</h1>

      <div className="space-y-6">
        {fields.map((field, index) => (
          <div key={index} className="card">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-lg">Field {index + 1}</h3>
              {fields.length > 2 && (
                <button
                  onClick={() => removeField(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Key (unique identifier)
                </label>
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  className="input"
                  disabled={index < 2} // Don't allow changing name and email keys
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Type
                </label>
                <select
                  value={field.type}
                  onChange={(e) => updateField(index, { type: e.target.value })}
                  className="input"
                >
                  {FIELD_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Label
                </label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 mt-8">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Required</span>
                </label>
              </div>
            </div>

            {field.type === 'select' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options (comma-separated)
                </label>
                <input
                  type="text"
                  value={field.options?.join(', ') || ''}
                  onChange={(e) =>
                    updateField(index, {
                      options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                    })
                  }
                  className="input"
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}
          </div>
        ))}

        <button
          onClick={addField}
          className="btn btn-secondary w-full"
        >
          <Plus size={20} className="mr-2" />
          Add Field
        </button>

        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Form'}
          </button>
          <button
            onClick={() => navigate('/admin/events')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
