import { useState, useEffect } from 'react';
import api from '../utils/api';

const DEFAULT_CATEGORIES = [
    { value: 'ALL', label: 'All Events', icon: '🎯' },
    { value: 'MUSIC', label: 'Music', icon: '🎵' },
    { value: 'TECH', label: 'Tech', icon: '💻' },
    { value: 'SPORTS', label: 'Sports', icon: '⚽' },
    { value: 'ARTS', label: 'Arts', icon: '🎨' },
    { value: 'BUSINESS', label: 'Business', icon: '💼' },
    { value: 'EDUCATION', label: 'Education', icon: '📚' },
    { value: 'FOOD', label: 'Food', icon: '🍕' },
    { value: 'HEALTH', label: 'Health', icon: '🧘' },
    { value: 'SOCIAL', label: 'Social', icon: '🎉' },
    { value: 'OTHER', label: 'Other', icon: '✨' }
];

export default function CategoryFilter({ selectedCategory, onCategoryChange }) {
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

    useEffect(() => {
        // Optionally fetch categories from API
        api.get('/events/meta/categories')
            .then(res => {
                setCategories([{ value: 'ALL', label: 'All Events', icon: '🎯' }, ...res.data]);
            })
            .catch(() => {
                // Use defaults if API fails
            });
    }, []);

    return (
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex gap-2 min-w-max">
                {categories.map((cat) => (
                    <button
                        key={cat.value}
                        onClick={() => onCategoryChange(cat.value)}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
              ${selectedCategory === cat.value
                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }
            `}
                    >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
