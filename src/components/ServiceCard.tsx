import React, { useState } from 'react';
import { ServiceListing, Category, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { isAuthorDisconnected } from '../services/storage';
import {
  Heart,
  MapPin,
  Star,
  Sparkles,
  ArrowRight,
  Clock,
  Zap,
  Tag
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface ServiceCardProps {
  service: ServiceListing;
  category?: Category;
  isFavorite: boolean;
  onToggleFavorite: (serviceId: string) => void;
  onViewDetails: (service: ServiceListing) => void;
  onPromoteService?: (service: ServiceListing) => void;
  currentUser: User;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  category,
  isFavorite,
  onToggleFavorite,
  onViewDetails,
  onPromoteService,
  currentUser,
}) => {
  const { isAuthenticated, user: authUser } = useAuth();
  const [imgError, setImgError] = useState(false);

  const activeAuthUserId = isAuthenticated && authUser && !authUser.isDemo ? authUser.id : null;

  // Component-level visibility guard: only render published ('active') listings whose owner has an active session
  if (
    service.status !== 'active' ||
    service.ownerSessionActive === false ||
    isAuthorDisconnected(service.authorId, activeAuthUserId)
  ) {
    return null;
  }

  const isAuthenticatedOwner = Boolean(
    activeAuthUserId && activeAuthUserId === service.authorId
  );

  // Format price display
  const priceDisplay = () => {
    if (service.priceType === 'a_convenir') return 'A convenir';
    const formatted = `${service.price.toFixed(2).replace('.00', '')} €`;
    if (service.priceType === 'hora') return `${formatted} / hora`;
    if (service.priceType === 'trabajo') return `${formatted} / trabajo`;
    return formatted;
  };

  return (
    <div
      className={`group relative bg-white rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col overflow-hidden ${
        service.isFeatured
          ? 'border-amber-300/80 shadow-xs ring-1 ring-amber-200/50'
          : 'border-slate-200/80 shadow-xs'
      }`}
    >
      {/* Featured Header Ribbon if active */}
      {service.isFeatured && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3.5 py-1 text-[11px] font-bold flex items-center justify-between tracking-wide">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-100" />
            <span>ANUNCIO DESTACADO · {service.featuredPlanName || 'Prioridad'}</span>
          </div>
          <span className="text-[10px] text-amber-100 font-normal">Recomendado</span>
        </div>
      )}

      {/* Image Container with Fallback */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100">
        {!imgError && service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.title}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#E5F3EF] to-[#F7F9F8] p-4 text-[#0E5145]">
            <CategoryIcon name={category?.iconName || 'Layers'} className="w-10 h-10 mb-1 opacity-70" />
            <span className="text-xs font-semibold">{category?.name || 'Servicio'}</span>
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(service.id);
          }}
          className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all ${
            isFavorite
              ? 'bg-white text-rose-600 shadow-md scale-105'
              : 'bg-white/80 text-slate-600 hover:bg-white hover:text-rose-500 shadow-xs'
          }`}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-600' : ''}`} />
        </button>

        {/* Price Tag Overlay on image */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-sm border border-slate-100">
          <span className="text-xs font-bold text-[#0E5145] tabular-nums">
            {priceDisplay()}
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Unboxed Metadata: Category · Zone */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-[#146C5B]">{category?.name || 'Servicio'}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="flex items-center gap-1 text-slate-600 truncate">
              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
              {service.neighborhood}
            </span>
          </div>

          {/* Title */}
          <h3
            onClick={() => onViewDetails(service)}
            className="text-base font-bold text-slate-900 group-hover:text-[#146C5B] transition-colors line-clamp-2 cursor-pointer leading-snug"
          >
            {service.title}
          </h3>

          {/* Short Description */}
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {service.description}
          </p>
        </div>

        {/* Footer: Neighbor profile snippet + actions */}
        <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={service.authorAvatar}
              alt={service.authorName}
              className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">
                {service.authorName}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                <span className="tabular-nums">{service.authorRating.toFixed(1)}</span>
                <span className="text-slate-400 font-normal">({service.authorReviewCount})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Only the authenticated owner can promote their own listing */}
            {isAuthenticatedOwner && !service.isFeatured && onPromoteService && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromoteService(service);
                }}
                className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 transition-colors"
                title="Destacar este anuncio con uno de los 4 planes"
              >
                <Zap className="w-3 h-3 text-amber-600" />
                <span>Destacar</span>
              </button>
            )}

            <button
              onClick={() => onViewDetails(service)}
              className="px-3 py-1.5 text-xs font-semibold text-[#0E5145] bg-[#E5F3EF] hover:bg-[#146C5B] hover:text-white rounded-lg transition-colors flex items-center gap-1 active:scale-95"
            >
              <span>Consultar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
