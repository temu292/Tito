import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Heart,
  Shield,
  User as UserIcon,
  ChevronDown,
  Menu,
  X,
  LogIn,
  LogOut,
  UserCheck,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenPublish: () => void;
  onOpenPlans: () => void;
  onOpenHowItWorks: () => void;
  onOpenRules: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
  onOpenAuth: (tab?: 'login' | 'register') => void;
  activeSection?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSelectUser,
  favoritesCount,
  onOpenFavorites,
  onOpenPublish,
  onOpenPlans,
  onOpenHowItWorks,
  onOpenRules,
  onOpenAdmin,
  onOpenProfile,
  onOpenAuth,
}) => {
  const { isAuthenticated, user: authUser, signOut, canModerate } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6">
        
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="flex items-center group transition-transform active:scale-95"
            aria-label="VecinoYa Inicio"
          >
            <BrandLogo size="md" showTagline={true} />
          </a>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-700">
          <a
            href="#servicios"
            className="hover:text-[#146C5B] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Explorar servicios
          </a>
          <button
            onClick={onOpenHowItWorks}
            className="hover:text-[#146C5B] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Cómo funciona
          </button>
          <button
            onClick={onOpenPlans}
            className="hover:text-[#146C5B] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Destacar anuncio
          </button>
          <button
            onClick={onOpenRules}
            className="hover:text-[#146C5B] transition-colors whitespace-nowrap shrink-0 py-1 text-slate-500 hover:text-slate-900"
          >
            Confianza y normas
          </button>
          {canModerate && (
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
            >
              <Shield className="w-3.5 h-3.5 text-amber-700" />
              Panel Admin
            </button>
          )}
        </nav>

        {/* Zone 3: Actions & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Favorites Button */}
          <button
            onClick={onOpenFavorites}
            className="relative p-2 text-slate-600 hover:text-[#146C5B] hover:bg-[#E5F3EF]/60 rounded-xl transition-colors"
            title="Mis favoritos guardados"
            aria-label="Ver favoritos guardados"
          >
            <Heart className="w-5 h-5" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E07A5F] text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* User selector / Auth menu */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className={`flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition-all text-xs font-medium ${
                isAuthenticated
                  ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950'
                  : 'border-slate-200 hover:border-[#146C5B]/40 hover:bg-[#F7F9F8] text-slate-800'
              }`}
              aria-expanded={userDropdownOpen}
              aria-label="Menú de usuario y sesión"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className={`w-6 h-6 rounded-full object-cover ring-1 ${
                  isAuthenticated ? 'ring-emerald-500' : 'ring-slate-300'
                }`}
              />
              <span className="hidden md:inline font-semibold max-w-[100px] truncate">
                {currentUser.name.split(' ')[0]}
              </span>
              {isAuthenticated ? (
                <span className="hidden md:inline px-1.5 py-0.2 bg-emerald-200 text-emerald-900 text-[9px] rounded font-bold uppercase">
                  Auth
                </span>
              ) : (
                <span className="hidden md:inline px-1 py-0.2 bg-amber-100 text-amber-800 text-[9px] rounded font-bold uppercase">
                  Demo
                </span>
              )}
              {currentUser.role === 'admin' && (
                <span className="hidden md:inline px-1 py-0.2 bg-purple-100 text-purple-800 text-[9px] rounded font-bold">
                  Admin
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in zoom-in-95">
                  {isAuthenticated ? (
                    // AUTHENTICATED USER MENU
                    <>
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                            Sesión Supabase Auth
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                          {currentUser.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {currentUser.email}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          onOpenProfile();
                          setUserDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-[#146C5B]" />
                        <span>Mi perfil y mis anuncios</span>
                      </button>

                      {canModerate && (
                        <button
                          onClick={() => {
                            onOpenAdmin();
                            setUserDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 transition-colors mt-1"
                        >
                          <Shield className="w-4 h-4 text-amber-700" />
                          <span>Panel de Moderación Admin</span>
                        </button>
                      )}

                      <div className="pt-2 mt-1 border-t border-slate-100">
                        <button
                          onClick={async () => {
                            await signOut();
                            setUserDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Cerrar sesión</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    // DEMO / GUEST USER MENU
                    <>
                      <div className="px-3 py-2 border-b border-slate-100 mb-2 bg-[#E5F3EF]/30 rounded-lg">
                        <p className="text-[11px] font-bold text-[#0E5145] uppercase tracking-wider">
                          Modo Demostración
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Inicia sesión con Supabase Auth para publicar y gestionar anuncios reales.
                        </p>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            onClick={() => {
                              onOpenAuth('login');
                              setUserDropdownOpen(false);
                            }}
                            className="flex-1 py-1.5 bg-[#146C5B] text-white rounded-md text-center text-xs font-semibold hover:bg-[#0E5145] transition-colors"
                          >
                            Iniciar sesión
                          </button>
                          <button
                            onClick={() => {
                              onOpenAuth('register');
                              setUserDropdownOpen(false);
                            }}
                            className="flex-1 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-center text-xs font-semibold hover:bg-slate-50 transition-colors"
                          >
                            Registrarse
                          </button>
                        </div>
                      </div>

                      <div className="px-3 py-1">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Cambiar persona de prueba (Solo lectura)
                        </p>
                      </div>

                      {allUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            onSelectUser(user);
                            setUserDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-left text-xs transition-colors ${
                            currentUser.id === user.id
                              ? 'bg-[#E5F3EF] text-[#0E5145] font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate font-medium">{user.name}</p>
                              {user.role === 'admin' && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">{user.neighborhood}</p>
                          </div>
                        </button>
                      ))}

                      <div className="pt-2 mt-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            onOpenProfile();
                            setUserDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <UserIcon className="w-3.5 h-3.5" />
                          <span>Ver detalle del perfil demo</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Primary CTA: Publicar Servicio */}
          <button
            onClick={onOpenPublish}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#146C5B] hover:bg-[#0E5145] rounded-xl shadow-xs transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Publicar servicio</span>
            <span className="sm:hidden">Publicar</span>
          </button>

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 lg:hidden text-slate-700 hover:text-[#146C5B] rounded-lg"
            aria-label="Abrir menú de navegación"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2.5">
          <a
            href="#servicios"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#E5F3EF] hover:text-[#0E5145] rounded-lg"
          >
            Explorar servicios
          </a>
          <button
            onClick={() => {
              onOpenHowItWorks();
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#E5F3EF] hover:text-[#0E5145] rounded-lg"
          >
            Cómo funciona VecinoYa
          </button>
          <button
            onClick={() => {
              onOpenPlans();
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#E5F3EF] hover:text-[#0E5145] rounded-lg"
          >
            Planes de destacados (1,50 € a 8,00 €)
          </button>
          <button
            onClick={() => {
              onOpenRules();
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#E5F3EF] hover:text-[#0E5145] rounded-lg"
          >
            Seguridad, privacidad y normas
          </button>
          {canModerate && (
            <button
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-amber-700" />
              Panel de Administración
            </button>
          )}
          {!isAuthenticated && (
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  onOpenAuth('login');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-2 bg-[#146C5B] text-white text-xs font-semibold rounded-lg text-center"
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => {
                  onOpenAuth('register');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-2 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg text-center"
              >
                Crear cuenta
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
