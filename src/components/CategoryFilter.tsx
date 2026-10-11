import React from 'react';
import { Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { Sparkles } from 'lucide-react';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  serviceCounts: Record<string, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  serviceCounts,
}) => {
  const totalServices = Object.values(serviceCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#0E5145]">
            Categorías de servicios
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecciona para explorar los talentos disponibles en tu vecindario
          </p>
        </div>
        {selectedCategoryId && (
          <button
            onClick={() => onSelectCategory('')}
            className="text-xs font-semibold text-[#146C5B] hover:underline cursor-pointer"
          >
            Ver todas ({totalServices})
          </button>
        )}
      </div>

      {/* Responsive Horizontal Scroll / Grid */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => onSelectCategory('')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
            selectedCategoryId === ''
              ? 'bg-[#146C5B] text-white border-[#146C5B] shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:border-[#146C5B]/40 hover:bg-[#E5F3EF]/30'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Todas</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
            selectedCategoryId === '' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {totalServices}
          </span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          const count = serviceCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? '' : cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                isSelected
                  ? 'bg-[#146C5B] text-white border-[#146C5B] shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#146C5B]/40 hover:bg-[#E5F3EF]/30'
              }`}
            >
              <CategoryIcon
                name={cat.iconName}
                className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#146C5B]'}`}
              />
              <span>{cat.name}</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
