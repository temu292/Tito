import React, { useState } from 'react';
import { ServiceListing, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';
import {
  X,
  MapPin,
  Calendar,
  Sparkles,
  Zap,
  Trash2,
  ExternalLink,
  Plus,
  Mail,
  Phone,
  Shield,
  KeyRound,
  UserPlus,
  LogIn,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Save,
  Info
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  userServices: ServiceListing[];
  onOpenPublish: () => void;
  onOpenPromote: (service: ServiceListing) => void;
  onViewService: (service: ServiceListing) => void;
  onEditService?: (service: ServiceListing) => void;
  onDeleteService: (serviceId: string) => Promise<{ success: boolean; error?: string }> | void;
  initialTab?: 'profile' | 'login' | 'register';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  userServices,
  onOpenPublish,
  onOpenPromote,
  onViewService,
  onEditService,
  onDeleteService,
  initialTab = 'profile'
}) => {
  const {
    isAuthenticated,
    user: authUser,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    canPublish
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'login' | 'register' | 'forgot_password'>(
    isAuthenticated ? 'profile' : initialTab
  );

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState('Chamberí');
  const [regCity, setRegCity] = useState('Madrid');
  const [regPhone, setRegPhone] = useState('+34 ');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Password recovery state
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editNeighborhood, setEditNeighborhood] = useState(user.neighborhood);
  const [editCity, setEditCity] = useState(user.city);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editBio, setEditBio] = useState(user.bio);
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation & error state
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ serviceId: string; message: string } | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Introduce tu correo electrónico y tu contraseña.');
      return;
    }
    setLoginLoading(true);
    const res = await signIn(loginEmail.trim(), loginPassword);
    setLoginLoading(false);
    if (res.success) {
      setActiveTab('profile');
    } else {
      setLoginError(res.error || 'Credenciales no válidas.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    if (!regName.trim() || regName.trim().length < 3) {
      setRegError('Introduce tu nombre y apellidos (mínimo 3 caracteres).');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Introduce un correo electrónico válido.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setRegError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!regNeighborhood.trim()) {
      setRegError('Indica tu barrio habitual.');
      return;
    }

    setRegLoading(true);
    const res = await signUp({
      name: regName.trim(),
      email: regEmail.trim(),
      password: regPassword,
      neighborhood: regNeighborhood.trim(),
      city: regCity.trim(),
      phone: regPhone.trim()
    });
    setRegLoading(false);

    if (res.success) {
      setRegSuccess('¡Cuenta creada con éxito! Si Supabase requiere confirmación por email, revisa tu bandeja de entrada.');
      setActiveTab('profile');
    } else {
      setRegError(res.error || 'No se pudo completar el registro.');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetMessage(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setResetError('Introduce un correo electrónico válido.');
      return;
    }
    setResetLoading(true);
    const res = await resetPassword(resetEmail.trim());
    setResetLoading(false);
    if (res.success) {
      setResetMessage('Te hemos enviado un correo de recuperación. Revisa tu bandeja de entrada o spam.');
    } else {
      setResetError(res.error || 'No se pudo enviar el correo de recuperación.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(false);

    if (!editName.trim()) {
      setEditError('El nombre no puede estar vacío.');
      return;
    }

    setEditLoading(true);
    const res = await updateProfile({
      name: editName.trim(),
      neighborhood: editNeighborhood.trim(),
      city: editCity.trim(),
      phone: editPhone.trim(),
      bio: editBio.trim()
    });
    setEditLoading(false);

    if (res.success) {
      setEditSuccess(true);
      setIsEditingProfile(false);
      setTimeout(() => setEditSuccess(false), 3000);
    } else {
      setEditError(res.error || 'Error al guardar los cambios del perfil.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with Navigation Tabs */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#E5F3EF]/40">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#0E5145]">
              {isAuthenticated ? 'Mi Cuenta en VecinoYa' : 'Autenticación & Perfil de Vecino'}
            </h3>
            {isAuthenticated ? (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Supabase Auth Activo
              </span>
            ) : (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                <Info className="w-3 h-3 text-amber-600" />
                Modo Demostración
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth status tabs (when not authenticated, allow quick switching) */}
        {!isAuthenticated && (
          <div className="flex border-b border-slate-200 bg-slate-50/60 px-4 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-2 border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-[#146C5B] text-[#0E5145]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Ver Perfil Demo
            </button>
            <button
              onClick={() => setActiveTab('login')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
                activeTab === 'login'
                  ? 'border-[#146C5B] text-[#0E5145]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Iniciar Sesión
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
                activeTab === 'register'
                  ? 'border-[#146C5B] text-[#0E5145]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Crear Cuenta Real
            </button>
            <button
              onClick={() => setActiveTab('forgot_password')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
                activeTab === 'forgot_password'
                  ? 'border-[#146C5B] text-[#0E5145]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Recuperar Clave
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* TAB 1: PROFILE VIEW */}
          {activeTab === 'profile' && (
            <>
              {/* Notice for Demo Mode */}
              {!isAuthenticated && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Estás viendo una cuenta de demostración local ({user.name})</p>
                    <p className="text-amber-800">
                      Los perfiles demo son de solo lectura. Para publicar anuncios con tu propia autoría verificada,
                      inicia sesión o regístrate con tu correo en Supabase Auth.
                    </p>
                    <div className="pt-1 flex gap-2">
                      <button
                        onClick={() => setActiveTab('login')}
                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                      >
                        Iniciar sesión
                      </button>
                      <button
                        onClick={() => setActiveTab('register')}
                        className="px-2.5 py-1 bg-white text-amber-900 border border-amber-300 rounded-lg font-semibold hover:bg-amber-100 transition-colors"
                      >
                        Crear cuenta
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status message after edit */}
              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Tu perfil ha sido actualizado correctamente en Supabase Auth.</span>
                </div>
              )}

              {/* User Profile Card */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-[#F7F9F8] border border-slate-200">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-18 h-18 rounded-full object-cover ring-3 ring-[#146C5B]/20 shadow-xs shrink-0"
                />
                <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h4 className="text-lg font-bold text-slate-900">{user.name}</h4>
                    {isAuthenticated ? (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                        Usuario Autenticado
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                        Demo
                      </span>
                    )}
                    {user.role === 'admin' && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                        Administrador
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {user.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#146C5B]" />
                      {user.neighborhood}, {user.city}
                    </span>
                    {user.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {user.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Desde {user.joinedDate}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 pt-1 leading-relaxed">
                    {user.bio}
                  </p>

                  {/* Actions for authenticated user */}
                  {isAuthenticated && !isEditingProfile && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setEditName(user.name);
                          setEditNeighborhood(user.neighborhood);
                          setEditCity(user.city);
                          setEditPhone(user.phone || '');
                          setEditBio(user.bio);
                          setIsEditingProfile(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-lg transition-colors shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Editar perfil</span>
                      </button>
                      <button
                        onClick={async () => {
                          await signOut();
                          setActiveTab('login');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline Edit Profile Form */}
              {isEditingProfile && isAuthenticated && (
                <form onSubmit={handleSaveProfile} className="p-4 rounded-xl border border-[#146C5B]/30 bg-[#E5F3EF]/20 space-y-3">
                  <h5 className="text-xs font-bold text-[#0E5145] uppercase tracking-wider">
                    Actualizar Información de Perfil (Supabase Auth)
                  </h5>
                  {editError && (
                    <p className="text-xs text-red-600 font-medium">{editError}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Nombre Completo</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={e => setEditPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Barrio</label>
                      <input
                        type="text"
                        value={editNeighborhood}
                        onChange={e => setEditNeighborhood(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Ciudad</label>
                      <input
                        type="text"
                        value={editCity}
                        onChange={e => setEditCity(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 font-semibold mb-1">Presentación / Biografía</label>
                    <textarea
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#146C5B] text-white text-xs font-semibold rounded-lg hover:bg-[#0E5145] transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editLoading ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* User's Published Services */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      Servicios asociados a este perfil ({userServices.length})
                    </h5>
                    <p className="text-xs text-slate-500">
                      {isAuthenticated
                        ? 'Gestiona tus propios anuncios vinculados a tu identidad de Supabase'
                        : 'Anuncios asignados a este identificador en la base de datos'}
                    </p>
                  </div>
                  {canPublish ? (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenPublish();
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-[#146C5B] hover:text-[#0E5145] p-1.5 rounded-lg hover:bg-[#E5F3EF]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nuevo anuncio</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveTab('login')}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#146C5B] p-1.5 rounded-lg hover:bg-slate-100"
                      title="Inicia sesión para publicar anuncios reales"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Iniciar sesión para publicar</span>
                    </button>
                  )}
                </div>

                {userServices.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs space-y-2">
                    <p>No hay ningún servicio registrado con este usuario actualmente.</p>
                    {canPublish ? (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenPublish();
                        }}
                        className="px-4 py-2 bg-[#146C5B] text-white rounded-xl font-semibold hover:bg-[#0E5145] transition-colors"
                      >
                        Publicar mi primer servicio
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveTab('login')}
                        className="px-4 py-2 bg-[#146C5B] text-white rounded-xl font-semibold hover:bg-[#0E5145] transition-colors"
                      >
                        Iniciar sesión para crear anuncios
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {userServices.map(service => {
                      const isOwner = Boolean(
                        canPublish && authUser && !authUser.isDemo && service.authorId === authUser.id
                      );
                      const isConfirming = confirmDeleteServiceId === service.id;
                      const isDeleting = deletingServiceId === service.id;
                      const serviceError = deleteError?.serviceId === service.id ? deleteError.message : null;

                      return (
                        <div
                          key={service.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col gap-3 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {service.status === 'draft' ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[10px]">
                                    Borrador editorial (Oculto)
                                  </span>
                                ) : service.status === 'suspended' ? (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                                    Suspendido
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                                    Publicado
                                  </span>
                                )}
                                {service.isFeatured ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[10px] flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-600" />
                                    {service.featuredPlanName || 'Destacado activo'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded text-[10px]">
                                    Estándar
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">· {service.neighborhood}</span>
                              </div>
                              <h6
                                onClick={() => {
                                  onClose();
                                  onViewService(service);
                                }}
                                className="text-sm font-bold text-slate-900 hover:text-[#146C5B] cursor-pointer truncate"
                              >
                                {service.title}
                              </h6>
                              <p className="text-xs font-semibold text-[#0E5145]">
                                {service.priceType === 'a_convenir'
                                  ? 'A convenir'
                                  : `${service.price} € ${service.priceType === 'hora' ? '/ hora' : ''}`}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isOwner && service.status === 'active' && !service.isFeatured && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenPromote(service);
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center gap-1 transition-colors"
                                  title="Aumentar visibilidad con un plan destacado"
                                >
                                  <Zap className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Destacar</span>
                                </button>
                              )}

                              {isOwner && service.status !== 'suspended' && onEditService && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onEditService(service);
                                  }}
                                  className="p-2 text-[#0E5145] hover:bg-[#E5F3EF]/60 rounded-lg transition-colors"
                                  title="Editar anuncio"
                                  aria-label="Editar anuncio"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onViewService(service);
                                }}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                title="Ver anuncio completo"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>

                              {isOwner && !isConfirming && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteError(null);
                                    setConfirmDeleteServiceId(service.id);
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                                  title="Eliminar anuncio"
                                  aria-label="Eliminar anuncio"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="sm:hidden">Eliminar anuncio</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Error Banner if Supabase deletion failed */}
                          {serviceError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-bold text-red-900">No se pudo eliminar el anuncio</p>
                                <p className="mt-0.5">{serviceError}</p>
                              </div>
                            </div>
                          )}

                          {/* Inline Confirmation Dialog */}
                          {isConfirming && isOwner && (
                            <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="text-red-900 space-y-0.5">
                                <p className="font-bold">¿Seguro que deseas eliminar este anuncio?</p>
                                <p className="text-red-700">
                                  Se retirará «{service.title}» de forma permanente.
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => {
                                    setConfirmDeleteServiceId(null);
                                    setDeleteError(null);
                                  }}
                                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={async () => {
                                    setDeletingServiceId(service.id);
                                    setDeleteError(null);
                                    const res = await onDeleteService(service.id);
                                    setDeletingServiceId(null);
                                    if (res && !res.success) {
                                      setDeleteError({
                                        serviceId: service.id,
                                        message: res.error || 'Error al eliminar el anuncio en Supabase.'
                                      });
                                      setConfirmDeleteServiceId(null);
                                      return;
                                    }
                                    setConfirmDeleteServiceId(null);
                                  }}
                                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: INICIAR SESIÓN */}
          {activeTab === 'login' && (
            <div className="max-w-md mx-auto space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-[#E5F3EF] text-[#0E5145] rounded-full flex items-center justify-center mx-auto mb-2">
                  <LogIn className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Iniciar Sesión en VecinoYa</h4>
                <p className="text-xs text-slate-500">
                  Autenticación real y segura con Supabase Auth.
                </p>
              </div>

              {!isSupabaseConfigured && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    Supabase aún no está configurado en el archivo de entorno. Configura
                    <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> para conectar la base de datos real.
                  </p>
                </div>
              )}

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{loginError}</p>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="tu.correo@ejemplo.es"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 focus:border-[#146C5B] outline-hidden"
                    required
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('forgot_password')}
                      className="text-xs text-[#146C5B] hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 focus:border-[#146C5B] outline-hidden"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 bg-[#146C5B] hover:bg-[#0E5145] text-white font-semibold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loginLoading ? 'Iniciando sesión...' : 'Entrar a mi cuenta'}</span>
                </button>
              </form>

              <div className="text-center pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  ¿Aún no tienes cuenta?{' '}
                  <button
                    onClick={() => setActiveTab('register')}
                    className="font-bold text-[#146C5B] hover:underline"
                  >
                    Regístrate aquí
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CREAR CUENTA */}
          {activeTab === 'register' && (
            <div className="max-w-md mx-auto space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-emerald-50 text-[#146C5B] rounded-full flex items-center justify-center mx-auto mb-2">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Crear Cuenta en VecinoYa</h4>
                <p className="text-xs text-slate-500">
                  Publica y promociona servicios con tu identidad comunitaria real.
                </p>
              </div>

              {regSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p>{regSuccess}</p>
                </div>
              )}

              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{regError}</p>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre y apellidos
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Ej. María Fernández"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="maria.fernandez@ejemplo.es"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contraseña (mínimo 6 caracteres)
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Barrio / Zona
                    </label>
                    <input
                      type="text"
                      value={regNeighborhood}
                      onChange={e => setRegNeighborhood(e.target.value)}
                      placeholder="Ej. Chamberí, Retiro"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      value={regCity}
                      onChange={e => setRegCity(e.target.value)}
                      placeholder="Madrid"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono de contacto (opcional)
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                  />
                </div>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-2.5 bg-[#146C5B] hover:bg-[#0E5145] text-white font-semibold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{regLoading ? 'Creando cuenta...' : 'Crear mi cuenta'}</span>
                </button>
              </form>

              <div className="text-center pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  ¿Ya tienes una cuenta?{' '}
                  <button
                    onClick={() => setActiveTab('login')}
                    className="font-bold text-[#146C5B] hover:underline"
                  >
                    Inicia sesión
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: RECUPERAR CONTRASEÑA */}
          {activeTab === 'forgot_password' && (
            <div className="max-w-md mx-auto space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Recuperación de Contraseña</h4>
                <p className="text-xs text-slate-500">
                  Te enviaremos un correo con un enlace seguro para restablecer tu contraseña.
                </p>
              </div>

              {resetMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p>{resetMessage}</p>
                </div>
              )}

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{resetError}</p>
                </div>
              )}

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo electrónico asociado a tu cuenta
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="tu.correo@ejemplo.es"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#146C5B]/30 outline-hidden"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-2.5 bg-[#146C5B] hover:bg-[#0E5145] text-white font-semibold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  <span>{resetLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}</span>
                </button>
              </form>

              <div className="text-center pt-2 border-t border-slate-100">
                <button
                  onClick={() => setActiveTab('login')}
                  className="text-xs font-semibold text-[#146C5B] hover:underline"
                >
                  ← Volver a Iniciar Sesión
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="text-[11px] text-slate-400">
            {isAuthenticated ? 'Sesión activa en Supabase Auth' : 'Explorando VecinoYa'}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 text-white font-semibold text-xs rounded-xl hover:bg-slate-900 transition-colors"
          >
            Cerrar ventana
          </button>
        </div>
      </div>
    </div>
  );
};
