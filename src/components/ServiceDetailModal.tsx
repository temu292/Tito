import React, { useState } from 'react';
import { ServiceListing, Category, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { isAuthorDisconnected } from '../services/storage';
import {
  X,
  MapPin,
  Clock,
  Star,
  Heart,
  MessageCircle,
  Phone,
  Mail,
  ShieldAlert,
  Sparkles,
  Zap,
  Trash2,
  Share2,
  CheckCircle2,
  AlertCircle,
  Info,
  Edit3
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface ServiceDetailModalProps {
  service: ServiceListing | null;
  category?: Category;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (serviceId: string) => void;
  currentUser: User;
  onOpenContact: (service: ServiceListing) => void;
  onOpenPromote: (service: ServiceListing) => void;
  onOpenReport: (service: ServiceListing) => void;
  onEditService?: (service: ServiceListing) => void;
  onDeleteService?: (serviceId: string) => Promise<{ success: boolean; error?: string }> | void;
}

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  service,
  category,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
  currentUser,
  onOpenContact,
  onOpenPromote,
  onOpenReport,
  onEditService,
  onDeleteService,
}) => {
  const { isAuthenticated, user: authUser, canModerate } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeAuthUserId = isAuthenticated && authUser && !authUser.isDemo ? authUser.id : null;

  const isAuthenticatedOwner = Boolean(
    activeAuthUserId && service && activeAuthUserId === service.authorId
  );

  // Non-owners can only view published ('active') listings whose owner has an active session
  if (
    !isOpen ||
    !service ||
    (!isAuthenticatedOwner &&
      (service.status !== 'active' ||
        service.ownerSessionActive === false ||
        isAuthorDisconnected(service.authorId, activeAuthUserId)))
  ) {
    return null;
  }
  const canManage = isAuthenticatedOwner || canModerate;

  const priceDisplay = () => {
    if (service.priceType === 'a_convenir') return 'Precio a convenir';
    const formatted = `${service.price.toFixed(2).replace('.00', '')} €`;
    if (service.priceType === 'hora') return `${formatted} por hora`;
    if (service.priceType === 'trabajo') return `${formatted} por trabajo cerrado`;
    return formatted;
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-[#146C5B]">{category?.name || 'Servicio'}</span>
            <span aria-hidden="true">·</span>
            <span>{service.city}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
              title="Copiar enlace"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleFavorite(service.id)}
              className={`p-2 rounded-xl transition-colors ${
                isFavorite
                  ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                  : 'text-slate-500 hover:text-rose-600 hover:bg-slate-200/60'
              }`}
              title={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              aria-label="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6">
          {copiedLink && (
            <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Enlace copiado al portapapeles.</span>
            </div>
          )}

          {/* Featured Status Banner if applicable */}
          {service.isFeatured && (
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Anuncio destacado verificado ({service.featuredPlanName || 'Activo'})</span>
              </div>
              {service.featuredUntil && (
                <span className="text-[11px] text-amber-700">
                  Activo hasta: {new Date(service.featuredUntil).toLocaleDateString('es-ES')}
                </span>
              )}
            </div>
          )}

          {/* Main Visual */}
          {service.imageUrl && (
            <div className="rounded-xl overflow-hidden aspect-16/9 bg-slate-100 border border-slate-200/80 shadow-xs">
              <img
                src={service.imageUrl}
                alt={service.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Title and Price row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                {service.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#146C5B]" />
                  {service.neighborhood}, {service.city}
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {service.availability}
                </span>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <span className="text-2xl font-black text-[#0E5145] tabular-nums">
                {priceDisplay()}
              </span>
              <p className="text-[11px] text-slate-500">
                Acordado directamente sin intermediarios
              </p>
            </div>
          </div>

          {/* Detailed Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Descripción del servicio
            </h4>
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {service.description}
            </p>
          </div>

          {/* Additional Notes if any */}
          {service.additionalNotes && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#146C5B]" />
                Detalles adicionales del anunciante:
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {service.additionalNotes}
              </p>
            </div>
          )}

          {/* Author Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-[#F7F9F8] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={service.authorAvatar}
                alt={service.authorName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-xs"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{service.authorName}</p>
                <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  <span>{service.authorRating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal">({service.authorReviewCount} valoraciones de vecinos)</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">Vecino verificado de {service.neighborhood}</p>
              </div>
            </div>
          </div>

          {/* Community Trust & Security Notice */}
          <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
            <Info className="w-4 h-4 text-[#146C5B] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Consejo de seguridad VecinoYa:</strong> No transfieras dinero por adelantado ni facilites datos bancarios personales o documentos de identidad. Conoce al vecino en un lugar seguro del barrio.
            </p>
          </div>

          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          {confirmingDelete && canManage && (
            <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-red-900 space-y-0.5">
                <p className="font-bold">¿Seguro que deseas eliminar este anuncio?</p>
                <p className="text-red-700">Esta acción eliminará el servicio y no se puede deshacer.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setConfirmingDelete(false);
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
                    if (!onDeleteService) return;
                    setIsDeleting(true);
                    setDeleteError(null);
                    const res = await onDeleteService(service.id);
                    setIsDeleting(false);
                    if (res && !res.success) {
                      setDeleteError(res.error || 'Error al eliminar el anuncio.');
                      return;
                    }
                    setConfirmingDelete(false);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Report Button */}
            <button
              onClick={() => onOpenReport(service)}
              className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Denunciar este anuncio si incumple normas"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Denunciar</span>
            </button>

            {/* Authenticated owner edit button (not allowed if suspended by moderation) */}
            {isAuthenticatedOwner && service.status !== 'suspended' && onEditService && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditService(service);
                }}
                className="text-xs text-[#0E5145] hover:text-[#146C5B] flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-[#E5F3EF]/60 transition-colors font-medium"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar anuncio</span>
              </button>
            )}

            {/* Author/Admin delete button */}
            {canManage && onDeleteService && !confirmingDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmingDelete(true);
                }}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar anuncio</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Only the authenticated owner can boost their own active listing */}
            {isAuthenticatedOwner && service.status === 'active' && !service.isFeatured && (
              <button
                onClick={() => onOpenPromote(service)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-amber-700" />
                <span>Destacar (desde 1,50 €)</span>
              </button>
            )}

            {/* Contact Button */}
            <button
              onClick={() => onOpenContact(service)}
              className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#146C5B] hover:bg-[#0E5145] rounded-xl shadow-md transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contactar con {service.authorName.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
