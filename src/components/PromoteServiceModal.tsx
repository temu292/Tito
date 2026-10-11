import React, { useState, useEffect, useRef } from 'react';
import { BoostPlan, PaymentTransaction, ServiceListing, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { getCurrentSession } from '../services/supabase';
import {
  X,
  Sparkles,
  Check,
  CreditCard,
  ShieldCheck,
  Lock,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  LogIn
} from 'lucide-react';

interface PromoteServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: BoostPlan[];
  userServices: ServiceListing[];
  preSelectedService: ServiceListing | null;
  currentUser: User;
  onConfirmPromotion: (serviceId: string, plan: BoostPlan, transaction: PaymentTransaction) => void;
  onOpenAuth?: (tab?: 'login' | 'register') => void;
}

interface PayPalConfig {
  configured: boolean;
  clientId: string | null;
  environment: string;
  currency: string;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export const PromoteServiceModal: React.FC<PromoteServiceModalProps> = ({
  isOpen,
  onClose,
  plans,
  userServices,
  preSelectedService,
  currentUser,
  onConfirmPromotion,
  onOpenAuth
}) => {
  const { isAuthenticated, user: authUser } = useAuth();
  const isRealAuthenticatedUser = Boolean(isAuthenticated && authUser && !authUser.isDemo);

  // Only allow the authenticated owner to promote their own services
  const ownedServices = isRealAuthenticatedUser && authUser
    ? userServices.filter(s => s.authorId === authUser.id && s.status === 'active')
    : [];
  const validPreSelected =
    isRealAuthenticatedUser &&
    authUser &&
    preSelectedService?.authorId === authUser.id &&
    preSelectedService?.status === 'active'
      ? preSelectedService
      : null;

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    validPreSelected?.id || (ownedServices[0]?.id ?? '')
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string>('intermedio');
  const [step, setStep] = useState<'select' | 'review' | 'processing' | 'success'>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<PaymentTransaction | null>(null);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<'synced' | 'pending' | 'failed'>('pending');

  // Server PayPal config state
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);

  const paypalButtonContainerRef = useRef<HTMLDivElement>(null);
  const renderedButtonsRef = useRef<any>(null);

  // Fetch server configuration on open
  useEffect(() => {
    if (isOpen) {
      checkServerConfig();
      setPaymentError(null);
      setStep('select');
      if (validPreSelected?.id) {
        setSelectedServiceId(validPreSelected.id);
      } else if (ownedServices[0]?.id) {
        setSelectedServiceId(ownedServices[0].id);
      } else {
        setSelectedServiceId('');
      }
    }
  }, [isOpen, validPreSelected?.id, ownedServices.length]);

  const checkServerConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const res = await fetch('/api/paypal/config');
      if (res.ok) {
        const data = await res.json();
        setPaypalConfig(data);
      } else {
        setPaypalConfig({ configured: false, clientId: null, environment: 'sandbox', currency: 'EUR' });
      }
    } catch {
      setPaypalConfig({ configured: false, clientId: null, environment: 'sandbox', currency: 'EUR' });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const currentService = ownedServices.find(s => s.id === selectedServiceId) || validPreSelected;
  const currentPlan = plans.find(p => p.id === selectedPlanId) || plans[1];

  // Dynamically load PayPal SDK script when in review step and clientId is available
  useEffect(() => {
    if (step !== 'review' || !paypalConfig?.configured || !paypalConfig.clientId || !isRealAuthenticatedUser) {
      return;
    }

    const scriptId = 'paypal-sdk-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderButtons = () => {
      if (!window.paypal || !paypalButtonContainerRef.current) return;

      // Clean up previous buttons if any
      paypalButtonContainerRef.current.innerHTML = '';

      try {
        renderedButtonsRef.current = window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
            height: 44
          },
          createOrder: async () => {
            setPaymentError(null);
            const session = await getCurrentSession();
            const token = session?.access_token;
            if (!token || !isRealAuthenticatedUser) {
              throw new Error('Debes iniciar sesión con tu cuenta real de Supabase Auth para procesar la orden.');
            }

            const res = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                planId: currentPlan.id,
                serviceId: currentService?.id,
                serviceTitle: currentService?.title
              })
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'Error al inicializar la orden con el servidor.');
            }
            return data.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            setIsProcessing(true);
            setStep('processing');
            setPaymentError(null);

            try {
              const session = await getCurrentSession();
              const token = session?.access_token;
              if (!token) {
                throw new Error('Sesión de Supabase Auth no disponible para verificar la captura.');
              }

              const res = await fetch('/api/paypal/capture-order', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  orderId: data.orderID
                })
              });

              const result = await res.json();
              if (!res.ok || result.status !== 'COMPLETED') {
                throw new Error(result.error || 'El pago no pudo ser confirmado por PayPal.');
              }

              const isSynced = result.supabaseSyncStatus === 'synced';
              setSupabaseSyncStatus(isSynced ? 'synced' : 'pending');

              const verifiedServiceId = String(result.serviceId || currentService!.id);
              const verifiedPlan =
                plans.find(p => p.id === result.planId) || currentPlan;
              const verifiedAmount =
                typeof result.amount === 'number' && Number.isFinite(result.amount)
                  ? result.amount
                  : verifiedPlan.price;

              const tx: PaymentTransaction = {
                id: result.captureId || `tx_${Date.now()}`,
                serviceId: verifiedServiceId,
                serviceTitle: String(result.serviceTitle || currentService!.title),
                userId: authUser?.id || currentUser.id,
                userName: authUser?.name || currentUser.name,
                planId: verifiedPlan.id,
                planName: String(result.planName || verifiedPlan.name),
                amount: verifiedAmount,
                currency: 'EUR',
                status: isSynced ? 'completed' : 'pending',
                createdAt: result.createdAt || new Date().toISOString(),
                expiresAt: result.expiresAt,
                referenceCode: `PAYPAL-${data.orderID.slice(-8)}`,
                provider: 'stripe_gateway' // stored transaction format
              };

              setLastTx(tx);
              setIsProcessing(false);
              setStep('success');

              // Only notify app to apply featured status to UI if Supabase sync was confirmed
              if (isSynced) {
                onConfirmPromotion(verifiedServiceId, verifiedPlan, tx);
              }
            } catch (err: any) {
              setIsProcessing(false);
              setStep('review');
              setPaymentError(err.message || 'Error al verificar la captura de PayPal.');
            }
          },
          onError: (err: any) => {
            console.error('PayPal button error:', err);
            setPaymentError('Se produjo un error en la ventana de PayPal. Verifica que tu cuenta de prueba Sandbox esté activa.');
          },
          onCancel: () => {
            setPaymentError('Operación cancelada por el usuario en PayPal.');
          }
        });

        renderedButtonsRef.current.render(paypalButtonContainerRef.current);
      } catch (err) {
        console.error('Failed to render PayPal buttons:', err);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.clientId}&currency=EUR&intent=capture&components=buttons`;
      script.async = true;
      script.onload = () => {
        setIsSdkLoaded(true);
        renderButtons();
      };
      script.onerror = () => {
        setPaymentError('No se pudo cargar el SDK de PayPal. Revisa la conexión de red.');
      };
      document.body.appendChild(script);
    } else if (window.paypal) {
      renderButtons();
    }
  }, [step, paypalConfig, currentPlan, currentService, isRealAuthenticatedUser]);

  if (!isOpen) return null;

  const now = new Date();
  const expiryDate = new Date(now.getTime() + (currentPlan.durationDays * 86400000));

  const handleStartReview = () => {
    if (!currentService) return;
    setStep('review');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#E5F3EF]/60 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#146C5B] text-white rounded-xl shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0E5145]">
                Destacar anuncio en VecinoYa
              </h3>
              <p className="text-xs text-slate-500">
                Aumenta tu visibilidad local mediante PayPal Checkout Sandbox
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {step === 'select' && (
            <>
              {/* Service Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Selecciona el servicio que quieres promocionar
                </label>
                {ownedServices.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        {isRealAuthenticatedUser
                          ? 'No tienes anuncios activos publicados con tu cuenta.'
                          : 'Inicia sesión para promocionar tus propios anuncios.'}
                      </p>
                      <p className="mt-0.5">
                        Solo el propietario con sesión activa en Supabase Auth puede contratar un plan de destacado para sus propios anuncios.
                      </p>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
                  >
                    {ownedServices.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.title} ({service.neighborhood}) {service.isFeatured ? '— [Actualmente destacado]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 4 Boost Plans Cards */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>2. Elige tu plan de visibilidad</span>
                  <span className="text-[11px] text-[#146C5B] font-semibold lowercase">Precios oficiales en el servidor en EUR con IVA</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {plans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`relative p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#146C5B] bg-[#E5F3EF]/30 shadow-md ring-2 ring-[#146C5B]/40'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-extrabold text-[#0E5145]">
                              {plan.name}
                            </span>
                            <div className="text-right">
                              <span className="text-xl font-black text-[#0E5145] tabular-nums">
                                {plan.price.toFixed(2).replace('.', ',')} €
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Clock className="w-3.5 h-3.5 text-[#146C5B]" />
                            <span>Duración: <strong>{plan.durationDays} días</strong></span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-[#146C5B]">{plan.badgeLabel}</span>
                          </div>

                          <p className="text-xs text-slate-500 italic">
                            "{plan.tagline}"
                          </p>

                          <ul className="space-y-1 pt-1.5 border-t border-slate-100 text-xs text-slate-600">
                            {plan.benefits.map((benefit, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-3 mt-2 flex items-center justify-end">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-[#146C5B] border-[#146C5B] text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Server Security & PayPal Architecture Note */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-[#146C5B]" />
                    <span>Pasarela de cobro PayPal Sandbox (Backend Seguro)</span>
                  </div>
                  <button
                    onClick={checkServerConfig}
                    className="flex items-center gap-1 text-[11px] text-[#146C5B] hover:underline"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingConfig ? 'animate-spin' : ''}`} />
                    <span>Verificar servidor</span>
                  </button>
                </div>
                <p className="leading-relaxed">
                  El importe del destacado está validado exclusivamente en el backend (Node.js/Express en <code>/server.ts</code>). El secreto de cliente de PayPal (<code>PAYPAL_CLIENT_SECRET</code>) permanece protegido en el servidor y nunca se expone al navegador.
                </p>
              </div>
            </>
          )}

          {step === 'review' && currentService && (
            <div className="space-y-5">
              {/* Order breakdown */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                  Resumen de la orden de destacado
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Anuncio seleccionado:</span>
                    <p className="font-semibold text-slate-800 line-clamp-1">{currentService.title}</p>
                    <p className="text-slate-500">{currentService.neighborhood}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Plan contratado:</span>
                    <p className="font-semibold text-[#0E5145]">{currentPlan.name}</p>
                    <p className="text-slate-500">Duración: {currentPlan.durationDays} días naturales</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Vigencia del destacado:</span>
                    <p className="font-semibold text-slate-800">
                      Del {now.toLocaleDateString('es-ES')} al {expiryDate.toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Importe a pagar:</span>
                    <p className="text-base font-extrabold text-[#0E5145] tabular-nums">
                      {currentPlan.price.toFixed(2).replace('.', ',')} €
                    </p>
                    <p className="text-[11px] text-slate-500">IVA incluido</p>
                  </div>
                </div>
              </div>

              {/* Payment Error Alert if triggered */}
              {paymentError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Error en la transacción de PayPal</p>
                    <p className="mt-0.5 leading-relaxed">{paymentError}</p>
                  </div>
                </div>
              )}

              {/* Auth Verification Guard for Payments */}
              {!isRealAuthenticatedUser ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-amber-900 text-sm">
                        Autenticación requerida para pagos y destacados
                      </h5>
                      <p className="mt-1 leading-relaxed text-amber-800">
                        Para contratar un plan de destacado y vincular la orden de PayPal a tu cuenta, debes identificarte con tu usuario de Supabase Auth. Los perfiles de demostración son de solo lectura.
                      </p>
                    </div>
                  </div>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuth('login');
                      }}
                      className="w-full py-2.5 bg-[#146C5B] hover:bg-[#0E5145] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Iniciar sesión con Supabase Auth</span>
                    </button>
                  )}
                </div>
              ) : paypalConfig?.configured ? (
                <div className="space-y-3 p-4 bg-[#F7F9F8] border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#146C5B]" />
                      <span className="text-xs font-bold text-slate-900">
                        {paypalConfig.environment === 'live' ? 'Pasarela Oficial PayPal LIVE' : 'Pasarela PayPal Sandbox (Pruebas)'}
                      </span>
                    </div>
                    {paypalConfig.environment === 'live' ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        Modo Real (LIVE)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-semibold border border-amber-200">
                        Modo Sandbox (Pruebas)
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {paypalConfig.environment === 'live' ? (
                      <>
                        Al pulsar el botón de PayPal autorizarás un cobro real de <strong>{currentPlan.price.toFixed(2).replace('.', ',')} €</strong> (IVA incluido) con tu cuenta de PayPal o tarjeta de débito/crédito.
                      </>
                    ) : (
                      <>
                        Pulsa el botón de PayPal para identificarte con tu cuenta de pruebas Sandbox y autorizar el cobro oficial de <strong>{currentPlan.price.toFixed(2).replace('.', ',')} €</strong>.
                      </>
                    )}
                  </p>

                  {/* PayPal SDK Button Container Mount */}
                  <div ref={paypalButtonContainerRef} className="min-h-[44px] pt-1" />

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#146C5B]" />
                      Cifrado SSL de 256 bits
                    </span>
                    <span>No almacenamos números de tarjeta</span>
                  </div>
                </div>
              ) : (
                /* Clear instructions when PayPal secrets are not yet added to Secrets panel */
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-amber-900 text-sm">
                        Credenciales de PayPal requeridas en el servidor
                      </h5>
                      <p className="leading-relaxed">
                        El servidor Express (<code>/server.ts</code>) está listo para procesar pagos tanto en <strong>Sandbox (pruebas)</strong> como en <strong>LIVE (real)</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/80 p-3 rounded-lg border border-amber-200/80 space-y-2 font-sans">
                    <p className="font-bold text-slate-900">Pasos para activar en tu proyecto:</p>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-700 leading-relaxed">
                      <li>Ve a <strong>developer.paypal.com</strong> y en <em>Dashboard &gt; Apps &amp; Credentials</em> elige la pestaña <strong>Live</strong> (para cobros reales) o <strong>Sandbox</strong> (para pruebas).</li>
                      <li>Abre el panel de <strong>Secrets</strong> en el menú de Google AI Studio.</li>
                      <li>Añade <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-900">PAYPAL_CLIENT_ID</code> con tu Client ID.</li>
                      <li>Añade <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-900">PAYPAL_CLIENT_SECRET</code> con tu Secret.</li>
                      <li>Para cobros reales, añade también <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-900">PAYPAL_ENVIRONMENT="live"</code> (si no se especifica, funcionará en sandbox por defecto).</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-amber-800">
                      El Secret nunca se comparte en el navegador.
                    </span>
                    <button
                      onClick={checkServerConfig}
                      className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingConfig ? 'animate-spin' : ''}`} />
                      <span>Comprobar credenciales</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-[#146C5B] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-800">
                Verificando orden y capturando cobro en PayPal Sandbox...
              </p>
              <p className="text-xs text-slate-500">
                El servidor está confirmando el estado COMPLETED directamente con la API de PayPal.
              </p>
            </div>
          )}

          {step === 'success' && lastTx && (
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              <div className={`w-12 h-12 ${supabaseSyncStatus === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} rounded-full flex items-center justify-center`}>
                {supabaseSyncStatus === 'synced' ? (
                  <Check className="w-6 h-6 stroke-[3]" />
                ) : (
                  <AlertCircle className="w-6 h-6 stroke-[2]" />
                )}
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-[#0E5145]">
                  {supabaseSyncStatus === 'synced'
                    ? '¡Pago verificado y destacado activado!'
                    : '¡Pago capturado en PayPal (Aplicación en cola)!'}
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md">
                  {supabaseSyncStatus === 'synced'
                    ? 'PayPal ha confirmado la captura de fondos en Sandbox y tu anuncio ya cuenta con máxima prioridad visual.'
                    : 'El cobro ha sido procesado y registrado con éxito por PayPal. La sincronización de la base de datos se completará automáticamente mediante la conciliación del servidor.'}
                </p>
              </div>

              <div className="w-full max-w-sm p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Estado de pago:</span>
                  <span className="font-bold text-emerald-700">CAPTURA COMPLETADA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estado de promoción:</span>
                  <span className={`font-bold ${supabaseSyncStatus === 'synced' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {supabaseSyncStatus === 'synced' ? 'ACTIVADA' : 'PENDIENTE DE APLICAR'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Referencia de PayPal:</span>
                  <span className="font-mono font-bold text-slate-800">{lastTx.referenceCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plan contratado:</span>
                  <span className="font-semibold text-[#0E5145]">{lastTx.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Importe cobrado:</span>
                  <span className="font-bold text-slate-800 tabular-nums">{lastTx.amount.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destacado hasta:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(lastTx.expiresAt).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          {step === 'select' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleStartReview}
                disabled={!currentService}
                className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#146C5B] hover:bg-[#0E5145] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all"
              >
                <span>Continuar a confirmación</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors"
              >
                Volver a planes
              </button>
              <span className="text-xs text-slate-500">
                Paga a través del botón oficial de PayPal situado arriba
              </span>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#146C5B] hover:bg-[#0E5145] rounded-xl transition-all"
              >
                Listo, ver mi anuncio destacado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
