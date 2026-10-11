import React, { useState, useEffect } from 'react';
import { Category, ContactMethod, PriceType, ServiceListing, User } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  LogIn,
  Lock,
  Save
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface PublishServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currentUser: User;
  onPublishSuccess: (
    service: ServiceListing
  ) =>
    | Promise<{
        success: boolean;
        syncedWithSupabase?: boolean;
        error?: string;
        supabaseError?: {
          code: string;
          message: string;
          details: string | null;
          hint?: string | null;
        };
      }>
    | void;
  editingService?: ServiceListing | null;
  onUpdateSuccess?: (service: ServiceListing) => Promise<{ success: boolean; error?: string }> | void;
  onOpenAuth?: (tab?: 'login' | 'register') => void;
}

export const PublishServiceModal: React.FC<PublishServiceModalProps> = ({
  isOpen,
  onClose,
  categories,
  currentUser,
  onPublishSuccess,
  editingService = null,
  onUpdateSuccess,
  onOpenAuth,
}) => {
  const { isAuthenticated, user: authUser, canPublish } = useAuth();
  const effectiveUser = (isAuthenticated && authUser) ? authUser : currentUser;
  const isEditing = Boolean(editingService);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'hogar');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('15');
  const [priceType, setPriceType] = useState<PriceType>('hora');
  const [neighborhood, setNeighborhood] = useState(effectiveUser.neighborhood || 'Centro');
  const [city, setCity] = useState(effectiveUser.city || 'Madrid');
  const [availability, setAvailability] = useState('Lunes a Viernes (tardes) y fines de semana');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('whatsapp');
  const [contactValue, setContactValue] = useState(effectiveUser.phone || '+34 600 000 000');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [selectedPresetImage, setSelectedPresetImage] = useState<string>(
    '/src/assets/images/service_home_repairs_1791572265993.jpg'
  );
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [editorialStatus, setEditorialStatus] = useState<'active' | 'draft'>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill form when editing an existing listing or reset when opening for new listing
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (editingService) {
      setTitle(editingService.title);
      setCategoryId(editingService.categoryId);
      setDescription(editingService.description);
      setPrice(String(editingService.price || 15));
      setPriceType(editingService.priceType);
      setNeighborhood(editingService.neighborhood);
      setCity(editingService.city);
      setAvailability(editingService.availability);
      setContactMethod(editingService.contactMethod);
      setContactValue(editingService.contactValue);
      setAdditionalNotes(editingService.additionalNotes || '');
      setEditorialStatus(editingService.status === 'draft' ? 'draft' : 'active');
      if (editingService.imageUrl.startsWith('/src/assets/images/')) {
        setSelectedPresetImage(editingService.imageUrl);
        setCustomImageUrl('');
      } else {
        setCustomImageUrl(editingService.imageUrl);
      }
    } else {
      setTitle('');
      setCategoryId(categories[0]?.id || 'hogar');
      setDescription('');
      setPrice('15');
      setPriceType('hora');
      setNeighborhood(effectiveUser.neighborhood || 'Centro');
      setCity(effectiveUser.city || 'Madrid');
      setAvailability('Lunes a Viernes (tardes) y fines de semana');
      setContactMethod('whatsapp');
      setContactValue(effectiveUser.phone || '+34 600 000 000');
      setAdditionalNotes('');
      setEditorialStatus('active');
      setSelectedPresetImage('/src/assets/images/service_home_repairs_1791572265993.jpg');
      setCustomImageUrl('');
    }
  }, [isOpen, editingService]);

  if (!isOpen) return null;

  // Preset gallery photos
  const presetImages = [
    {
      url: '/src/assets/images/service_home_repairs_1791572265993.jpg',
      label: 'Reparaciones y bricolaje'
    },
    {
      url: '/src/assets/images/service_gardening_1791572287879.jpg',
      label: 'Jardinería y plantas'
    },
    {
      url: '/src/assets/images/service_pet_care_1791572277371.jpg',
      label: 'Mascotas'
    },
    {
      url: '/src/assets/images/service_tutoring_1791572297829.jpg',
      label: 'Clases y estudio'
    },
    {
      url: '/src/assets/images/hero_neighborhood_community_1791572255971.jpg',
      label: 'Vecindario y recados'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 6) {
      newErrors.title = 'El título debe tener al menos 6 caracteres descriptivos.';
    }
    if (!description.trim() || description.trim().length < 20) {
      newErrors.description = 'La descripción debe tener al menos 20 caracteres explicando el servicio.';
    }
    if (priceType !== 'a_convenir' && (!price || parseFloat(price) <= 0)) {
      newErrors.price = 'Introduce un importe válido mayor que 0.';
    }
    if (!neighborhood.trim()) {
      newErrors.neighborhood = 'Indica el barrio o zona donde ofreces el servicio.';
    }
    if (!contactValue.trim()) {
      newErrors.contactValue = 'Facilita un teléfono, email o identificador de contacto.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!isAuthenticated || !authUser || authUser.isDemo) {
      setErrors({
        auth: 'Debes iniciar sesión con tu cuenta real de Supabase Auth para publicar o editar anuncios en VecinoYa.'
      });
      return;
    }

    if (editingService && editingService.authorId !== authUser.id) {
      setErrors({
        auth: 'Solo el propietario autenticado puede editar su propio anuncio.'
      });
      return;
    }

    if (editingService && editingService.status === 'suspended') {
      setErrors({
        auth: 'No puedes editar ni reactivar un anuncio que ha sido suspendido por moderación.'
      });
      return;
    }

    const finalImage =
      customImageUrl.trim() ||
      selectedPresetImage ||
      '/src/assets/images/service_home_repairs_1791572265993.jpg';
    const validPriceType: PriceType =
      priceType === 'hora' || priceType === 'trabajo' || priceType === 'a_convenir'
        ? priceType
        : 'hora';
    const parsedPrice = validPriceType === 'a_convenir' ? 0 : parseFloat(price);
    const safePrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
    const validContactMethod: ContactMethod =
      contactMethod === 'whatsapp' ||
      contactMethod === 'phone' ||
      contactMethod === 'chat' ||
      contactMethod === 'email'
        ? contactMethod
        : 'whatsapp';
    const safeCity = (city || effectiveUser.city || 'Madrid').trim() || 'Madrid';
    const safeAvailability =
      availability.trim() || 'Lunes a Viernes (tardes) y fines de semana';
    const safeAuthorName = (authUser.name || 'Vecino').trim() || 'Vecino';
    const safeAuthorAvatar =
      authUser.avatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';

    if (editingService && onUpdateSuccess) {
      setIsSaving(true);
      const updatedService: ServiceListing = {
        ...editingService,
        title: title.trim(),
        categoryId: categoryId || 'hogar',
        description: description.trim(),
        price: safePrice,
        priceType: validPriceType,
        neighborhood: neighborhood.trim(),
        city: safeCity,
        availability: safeAvailability,
        imageUrl: finalImage,
        contactMethod: validContactMethod,
        contactValue: contactValue.trim(),
        additionalNotes: additionalNotes.trim() || undefined,
        authorId: authUser.id,
        authorName: safeAuthorName,
        authorAvatar: safeAuthorAvatar,
        authorRating:
          typeof editingService.authorRating === 'number' && Number.isFinite(editingService.authorRating)
            ? editingService.authorRating
            : 5.0,
        authorReviewCount:
          typeof editingService.authorReviewCount === 'number' &&
          Number.isFinite(editingService.authorReviewCount) &&
          editingService.authorReviewCount >= 0
            ? editingService.authorReviewCount
            : 0,
        status: editorialStatus,
        ownerSessionActive: true
      };
      const res = await onUpdateSuccess(updatedService);
      setIsSaving(false);
      if (res && !res.success) {
        setErrors({ auth: res.error || 'No se pudo guardar los cambios del anuncio.' });
        return;
      }
      onClose();
      return;
    }

    const newService: ServiceListing = {
      id: `srv_${Date.now()}`,
      title: title.trim(),
      categoryId: categoryId || 'hogar',
      description: description.trim(),
      price: safePrice,
      priceType: validPriceType,
      neighborhood: neighborhood.trim(),
      city: safeCity,
      availability: safeAvailability,
      imageUrl: finalImage,
      contactMethod: validContactMethod,
      contactValue: contactValue.trim(),
      additionalNotes: additionalNotes.trim() || undefined,
      authorId: authUser.id,
      authorName: safeAuthorName,
      authorAvatar: safeAuthorAvatar,
      authorRating: 5.0,
      authorReviewCount: 0,
      createdAt: new Date().toISOString(),
      status: editorialStatus,
      ownerSessionActive: true,
      isFeatured: false,
      reportCount: 0
    };

    setIsSaving(true);
    const res = await onPublishSuccess(newService);
    setIsSaving(false);

    if (res && !res.success) {
      const structuredMsg = res.supabaseError
        ? `[Código: ${res.supabaseError.code}] ${res.supabaseError.message}${
            res.supabaseError.details ? ` — Detalles: ${res.supabaseError.details}` : ''
          }${res.supabaseError.hint ? ` — Sugerencia: ${res.supabaseError.hint}` : ''}`
        : res.error || 'No se pudo guardar el anuncio en Supabase.';
      setErrors({ auth: structuredMsg });
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-lg font-bold text-[#0E5145]">
              {isEditing ? 'Editar mi anuncio' : 'Publicar un nuevo servicio en tu barrio'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing ? 'Modificando como propietario' : 'Publicando como'} <strong>{currentUser.name}</strong> ({currentUser.neighborhood})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Cerrar formulario"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {/* Auth Verification Banner */}
          {!canPublish ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Autenticación requerida para publicar</span>
              </div>
              <p className="text-amber-800">
                Estás navegando en modo demostración con un perfil simulado. Para publicar un anuncio real y que quede vinculado de forma segura a tu cuenta en Supabase Auth, debes iniciar sesión o crear una cuenta.
              </p>
              {onOpenAuth && (
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth('login');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#146C5B] text-white font-semibold rounded-lg hover:bg-[#0E5145] transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Iniciar sesión</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth('register');
                    }}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 font-semibold rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Crear cuenta
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Publicando como vecino verificado: <strong>{authUser?.name}</strong> ({authUser?.email})
              </span>
            </div>
          )}

          {errors.auth && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errors.auth}</span>
            </div>
          )}

          {/* Service Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Título del servicio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Pequeños arreglos de fontanería, montaje de muebles y persianas"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }}
              className={`w-full p-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                errors.title ? 'border-red-300 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-[#146C5B]'
              }`}
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} — {cat.description}
                </option>
              ))}
            </select>
          </div>

          {/* Price and Price Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Modalidad de precio <span className="text-red-500">*</span>
              </label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as PriceType)}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
              >
                <option value="hora">Precio por hora (€ / hora)</option>
                <option value="trabajo">Precio cerrado por tarea / trabajo</option>
                <option value="a_convenir">A convenir según presupuesto</option>
              </select>
            </div>

            {priceType !== 'a_convenir' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Importe en euros (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    if (errors.price) setErrors(prev => ({ ...prev, price: '' }));
                  }}
                  className={`w-full p-3 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                    errors.price ? 'border-red-300 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-[#146C5B]'
                  }`}
                />
                {errors.price && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.price}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Descripción detallada <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Explica qué incluye tu servicio, tu experiencia, las herramientas con las que cuentas y cualquier detalle de interés para tus vecinos."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
              }}
              className={`w-full p-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                errors.description ? 'border-red-300 focus:ring-red-400 bg-red-50/20' : 'border-slate-200 focus:ring-[#146C5B]'
              }`}
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Location and Availability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Barrio o zona <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Centro, Chamberí, Retiro, Ruzafa..."
                value={neighborhood}
                onChange={(e) => {
                  setNeighborhood(e.target.value);
                  if (errors.neighborhood) setErrors(prev => ({ ...prev, neighborhood: '' }));
                }}
                className={`w-full p-3 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                  errors.neighborhood ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-[#146C5B]'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Disponibilidad horaria
              </label>
              <input
                type="text"
                placeholder="Ej. Tardes de 16:00 a 20:00 y sábados"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
              />
            </div>
          </div>

          {/* Contact Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Método de contacto preferente
              </label>
              <select
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value as ContactMethod)}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
              >
                <option value="whatsapp">WhatsApp directo</option>
                <option value="phone">Llamada telefónica</option>
                <option value="chat">Mensajería en VecinoYa</option>
                <option value="email">Correo electrónico</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Teléfono o contacto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. +34 612 345 678"
                value={contactValue}
                onChange={(e) => {
                  setContactValue(e.target.value);
                  if (errors.contactValue) setErrors(prev => ({ ...prev, contactValue: '' }));
                }}
                className={`w-full p-3 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                  errors.contactValue ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-[#146C5B]'
                }`}
              />
            </div>
          </div>

          {/* Photo Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Foto del servicio
            </label>
            <p className="text-xs text-slate-500">
              Selecciona una fotografía fotográfica de calidad para tu anuncio:
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {presetImages.map((img) => (
                <div
                  key={img.url}
                  onClick={() => {
                    setSelectedPresetImage(img.url);
                    setCustomImageUrl('');
                  }}
                  className={`relative rounded-xl overflow-hidden aspect-square cursor-pointer border transition-all ${
                    selectedPresetImage === img.url && !customImageUrl
                      ? 'border-[#146C5B] ring-2 ring-[#146C5B]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] p-1 truncate text-center">
                    {img.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-1">
              <input
                type="url"
                placeholder="O escribe una URL de imagen personalizada (opcional)"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Información adicional (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Dispongo de coche propio, herramientas de desbroce, certificado de manipulador..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
            />
          </div>

          {/* Editorial Status Selector (Published vs Editorial Draft) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Estado editorial del anuncio
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setEditorialStatus('active')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  editorialStatus === 'active'
                    ? 'border-[#146C5B] bg-[#E5F3EF]/60 text-[#0E5145]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Publicado</span>
                  {editorialStatus === 'active' && <CheckCircle2 className="w-4 h-4 text-[#146C5B]" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Visible en los listados públicos mientras mantengas tu sesión iniciada.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setEditorialStatus('draft')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  editorialStatus === 'draft'
                    ? 'border-amber-500 bg-amber-50/70 text-amber-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Borrador editorial</span>
                  {editorialStatus === 'draft' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Guardado en privado en tu perfil. Nunca se publica solo al iniciar sesión.
                </p>
              </button>
            </div>
          </div>

          {/* Privacy & Anti-fraud Reminder */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-[#146C5B] shrink-0 mt-0.5" />
            <p>
              {editorialStatus === 'draft'
                ? 'Este borrador solo será visible para ti en tu perfil hasta que decidas publicarlo.'
                : 'Tu anuncio publicado será visible para los vecinos mientras tengas tu sesión activa en VecinoYa.'}
            </p>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            {!canPublish ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAuth) onOpenAuth('login');
                }}
                className="flex items-center gap-1.5 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Inicia sesión para publicar</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#146C5B] hover:bg-[#0E5145] rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isEditing || editorialStatus === 'draft' ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>
                  {isEditing
                    ? (isSaving ? 'Guardando...' : 'Guardar cambios')
                    : (isSaving
                        ? 'Guardando en Supabase...'
                        : editorialStatus === 'draft'
                          ? 'Guardar borrador'
                          : 'Publicar anuncio')}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
