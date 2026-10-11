import React, { useState, useEffect } from 'react';
import { ChatMessage, ServiceListing, User } from '../types';
import {
  X,
  MessageCircle,
  Phone,
  Mail,
  Send,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { getChatMessages, sendChatMessage } from '../services/storage';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceListing | null;
  currentUser: User;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  service,
  currentUser,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [warning, setWarning] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (service && isOpen) {
      setMessages(getChatMessages(service.id));
      setWarning('');
      setSentSuccess(false);
    }
  }, [service, isOpen]);

  if (!isOpen || !service) return null;

  // Basic anti-abuse & fraud pattern checks
  const checkForSensitiveData = (text: string): boolean => {
    // Regex for credit cards, passwords, or suspicious patterns
    const cardRegex = /\b(?:\d[ -]*?){13,16}\b/;
    const passwordPattern = /(contrase[ñn]a|password|clave secreta|pin ban)/i;
    return cardRegex.test(text) || passwordPattern.test(text);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (checkForSensitiveData(inputText)) {
      setWarning('Por tu seguridad, no compartas contraseñas, números de tarjeta ni datos bancarios en el chat.');
      return;
    }

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      serviceId: service.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: inputText.trim(),
      createdAt: new Date().toISOString()
    };

    sendChatMessage(newMsg);
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setWarning('');
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 3000);
  };

  // Build clean phone / whatsapp url
  const cleanPhone = service.contactValue.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hola ${service.authorName}, te escribo desde VecinoYa por tu anuncio: "${service.title}". ¿Tienes disponibilidad?`
  )}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <img
              src={service.authorAvatar}
              alt={service.authorName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-xs"
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Contactar con {service.authorName}
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-[240px]">
                {service.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Cerrar ventana de contacto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Direct channels strip */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Vías directas autorizadas
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {service.contactMethod === 'whatsapp' || service.contactValue.startsWith('+') || service.contactValue.startsWith('6') ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp directo</span>
                  <ExternalLink className="w-3 h-3 text-emerald-500" />
                </a>
              ) : null}

              {service.contactMethod === 'phone' || service.contactValue.includes('6') ? (
                <a
                  href={`tel:${cleanPhone}`}
                  className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Phone className="w-4 h-4 text-[#146C5B]" />
                  <span>Llamar por teléfono</span>
                </a>
              ) : null}

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center justify-center gap-1.5 col-span-2">
                <span className="text-slate-400">Contacto facilitado:</span>
                <strong className="text-slate-800">{service.contactValue}</strong>
              </div>
            </div>
          </div>

          {/* Internal In-App Messaging */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Mensaje interno en VecinoYa
              </span>
              <span className="text-[11px] text-slate-400">
                De: {currentUser.name}
              </span>
            </div>

            {/* Conversation Log if any messages sent */}
            <div className="min-h-[100px] max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              {messages.length === 0 ? (
                <div className="text-center py-4 text-slate-400">
                  <p>Aún no hay mensajes para este servicio.</p>
                  <p className="text-[11px] mt-0.5">Escribe tu consulta a continuación.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-2.5 rounded-xl max-w-[85%] ${
                        msg.senderId === currentUser.id
                          ? 'bg-[#146C5B] text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}
                    >
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Warning if triggered */}
            {warning && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            )}

            {sentSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mensaje enviado correctamente al vecino.</span>
              </div>
            )}

            {/* Input form */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Escribe tu consulta vecinal (fechas, dudas, presupuesto)..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 p-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#146C5B]"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2.5 bg-[#146C5B] text-white hover:bg-[#0E5145] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center shrink-0"
                aria-label="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Privacy reminder */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#146C5B] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Las conversaciones están sujetas a las normas comunitarias. No se tolerará spam, publicidad no solicitada ni comportamientos abusivos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
