import React from 'react';
import { Search, Heart, PlusCircle, User as UserIcon, Shield, Sparkles } from 'lucide-react';
import { User } from '../types';

interface MobileBottomNavProps {
  currentTab: 'explore' | 'favorites' | 'plans' | 'profile';
  onSelectTab: (tab: 'explore' | 'favorites' | 'plans' | 'profile') => void;
  onOpenPublish: () => void;
  favoritesCount: number;
  currentUser: User;
  onOpenAdmin: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenPublish,
  favoritesCount,
  currentUser,
  onOpenAdmin,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1 shadow-lg max-h-[64px]">
      <div className="flex items-center justify-around h-12">
        {/* Explorar */}
        <button
          onClick={() => onSelectTab('explore')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
            currentTab === 'explore' ? 'text-[#146C5B] font-bold' : 'text-slate-500'
          }`}
          aria-label="Explorar servicios"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Explorar</span>
        </button>

        {/* Planes Destacados */}
        <button
          onClick={() => onSelectTab('plans')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
            currentTab === 'plans' ? 'text-[#146C5B] font-bold' : 'text-slate-500'
          }`}
          aria-label="Planes de destacados"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Destacar</span>
        </button>

        {/* Publicar Central Button */}
        <button
          onClick={onOpenPublish}
          className="flex flex-col items-center justify-center -mt-3.5 bg-[#146C5B] text-white w-12 h-12 rounded-full shadow-md active:scale-95 transition-transform"
          aria-label="Publicar anuncio"
        >
          <PlusCircle className="w-6 h-6" />
        </button>

        {/* Favoritos */}
        <button
          onClick={() => onSelectTab('favorites')}
          className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
            currentTab === 'favorites' ? 'text-[#146C5B] font-bold' : 'text-slate-500'
          }`}
          aria-label="Ver favoritos guardados"
        >
          <Heart className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Favoritos</span>
          {favoritesCount > 0 && (
            <span className="absolute top-1 right-2.5 w-4 h-4 bg-[#E07A5F] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {favoritesCount}
            </span>
          )}
        </button>

        {/* Profile / Admin */}
        {currentUser.role === 'admin' ? (
          <button
            onClick={onOpenAdmin}
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] text-amber-700"
            aria-label="Panel administrador"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Admin</span>
          </button>
        ) : (
          <button
            onClick={() => onSelectTab('profile')}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
              currentTab === 'profile' ? 'text-[#146C5B] font-bold' : 'text-slate-500'
            }`}
            aria-label="Mi perfil vecinal"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-5 h-5 rounded-full object-cover ring-1 ring-emerald-600/30"
            />
            <span className="text-[10px] mt-0.5">Perfil</span>
          </button>
        )}
      </div>
    </div>
  );
};
