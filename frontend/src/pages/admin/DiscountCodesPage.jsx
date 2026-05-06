import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Tag, X, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function DiscountCodesPage() {
    const { id } = useParams();
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { register, handleSubmit, reset, formState: { errors } } = useForm();

    useEffect(() => {
        fetchCodes();
    }, [id]);

    const fetchCodes = async () => {
        try {
            const response = await api.get(`/discounts/events/${id}`);
            setCodes(response.data);
        } catch (error) {
            toast.error('Failed to fetch discount codes');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data) => {
        try {
            await api.post(`/discounts/events/${id}`, data);
            toast.success('Discount code created successfully');
            setIsModalOpen(false);
            reset();
            fetchCodes();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create code');
        }
    };

    const toggleStatus = async (codeId) => {
        try {
            await api.patch(`/discounts/${codeId}/toggle`);
            setCodes(codes.map(c => c.id === codeId ? { ...c, isActive: !c.isActive } : c));
            toast.success('Status updated');
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E23744] border-r-2 border-[#E23744]/30"></div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/admin/events" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Discount Codes</h1>
                        <p className="text-gray-400">Manage promo codes and discounts for this event.</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus size={20} />
                    New Code
                </button>
            </div>

            {codes.length === 0 ? (
                <div className="glass-card text-center py-20 border-dashed border-2 border-white/10 rounded-3xl bg-[#18181b]/40">
                    <Tag className="mx-auto text-gray-600 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-white mb-2">No discount codes</h3>
                    <p className="text-gray-400 mb-6">Create codes to boost your ticket sales.</p>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-primary inline-flex">
                        Create Code
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {codes.map((code) => (
                        <div key={code.id} className={`glass-card p-6 rounded-2xl border ${code.isActive ? 'border-white/5' : 'border-red-500/20 bg-red-500/5'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#E23744]/10 p-2.5 rounded-lg text-[#E23744]">
                                        <Tag size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg tracking-wide">{code.code}</h3>
                                        <p className="text-sm text-gray-400">
                                            {code.type === 'PERCENTAGE' ? `${code.amount}% OFF` : `₹${code.amount} OFF`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleStatus(code.id)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border ${code.isActive
                                            ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20'
                                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20'
                                        } transition-colors`}
                                >
                                    {code.isActive ? 'Active' : 'Inactive'}
                                </button>
                            </div>

                            <div className="space-y-3 text-sm text-gray-400 mb-6">
                                <div className="flex justify-between">
                                    <span>Used</span>
                                    <span className="text-white font-medium">
                                        {code.usedCount} {code.maxUses ? `/ ${code.maxUses}` : ''}
                                    </span>
                                </div>
                                {code.validUntil && (
                                    <div className="flex justify-between">
                                        <span>Expires</span>
                                        <span className="text-white">{format(new Date(code.validUntil), 'MMM d, yyyy')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">New Discount Code</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Code</label>
                                <input
                                    type="text"
                                    {...register('code', { required: true, pattern: /^[A-Za-z0-9_-]+$/ })}
                                    className="input uppercase"
                                    placeholder="SUMMER2024"
                                />
                                {errors.code && <p className="text-red-500 text-xs mt-1">Valid code required</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                                    <select {...register('type')} className="input">
                                        <option value="PERCENTAGE">Percentage (%)</option>
                                        <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Value</label>
                                    <input
                                        type="number"
                                        {...register('amount', { required: true, min: 1 })}
                                        className="input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Max Uses (Optional)</label>
                                <input type="number" {...register('maxUses')} className="input" placeholder="Unlimited" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Valid From</label>
                                    <input type="date" {...register('validFrom')} className="input" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Valid Until</label>
                                    <input type="date" {...register('validUntil')} className="input" />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="submit" className="btn btn-primary flex-1">Create Code</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
