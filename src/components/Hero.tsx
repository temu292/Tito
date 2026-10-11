import React from 'react';
import { Search, MapPin, Sparkles, ShieldCheck, HeartHandshake, Users } from 'lucide-react';
import { Category } from '../types';

interface HeroProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedNeighborhood: string;
  onNeighborhoodChange: (neighborhood: string) => void;
  neighborhoodList: string[];
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  onOpenPublish: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  searchQuery,
  onSearchChange,
  selectedNeighborhood,
  onNeighborhoodChange,
  neighborhoodList,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onOpenPublish,
}) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#E5F3EF]/60 via-[#F7F9F8] to-[#F7F9F8] pt-8 pb-12 lg:pt-14 lg:pb-16 border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Headline and Search Module */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#146C5B]">
                Comunidad local de confianza
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0E5145] tracking-tight leading-[1.15]" style={{ textWrap: 'balance' }}>
                Encuentra ayuda cerca de ti y comparte tus habilidades
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
                Reparaciones, cuidado de plantas, paseo de mascotas, clases particulares y tareas cotidianas entre personas de tu mismo barrio.
              </p>
            </div>

            {/* Interactive Search & Neighborhood Control */}
            <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200/90 flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-100">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="¿Qué servicio necesitas hoy? Ej. fontanería, plantas, perro..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div className="sm:w-52 flex items-center gap-2 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-100">
                <MapPin className="w-5 h-5 text-[#146C5B] shrink-0" />
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => onNeighborhoodChange(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="">Todos los barrios</option>
                  {neighborhoodList.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Popular quick filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium mr-1">Populares:</span>
              {categories.slice(0, 4).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(selectedCategoryId === cat.id ? '' : cat.id)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedCategoryId === cat.id
                      ? 'bg-[#146C5B] text-white border-[#146C5B] font-medium'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-[#146C5B]/40 hover:bg-[#E5F3EF]/40'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Trust points strip */}
            <div className="pt-2 grid grid-cols-3 gap-3 border-t border-slate-200/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#146C5B] shrink-0" />
                <span className="text-xs text-slate-600 font-medium">Trato directo y cercano</span>
              </div>
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#146C5B] shrink-0" />
                <span className="text-xs text-slate-600 font-medium">Sin comisiones abusivas</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#146C5B] shrink-0" />
                <span className="text-xs text-slate-600 font-medium">Vecinos verificados</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200/80 aspect-4/3 sm:aspect-16/10 lg:aspect-4/3 group">
              <img
                src="/src/assets/images/hero_neighborhood_community_1791572255971.jpg"
                alt="Vecinos en un barrio compartiendo momentos en la plaza"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-5 text-white">
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-300">
                  Comunidad VecinoYa
                </span>
                <p className="text-lg font-bold">
                  "Juntos hacemos barrio"
                </p>
                <p className="text-xs text-white/90 mt-0.5">
                  Conectando talentos y necesidades en cada manzana.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
