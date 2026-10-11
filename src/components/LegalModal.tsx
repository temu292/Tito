import React, { useState } from 'react';
import { X, Shield, FileText, Lock, CheckCircle, Scale } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy' | 'boost_terms' | 'rules';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'boost_terms' | 'rules'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-[#0E5145]">
            <Scale className="w-5 h-5 text-[#146C5B]" />
            <h3 className="text-base font-bold">
              Marco Legal, Privacidad y Convivencia Vecinal
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab strip */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'terms' ? 'border-[#146C5B] text-[#0E5145]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Condiciones de uso
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'privacy' ? 'border-[#146C5B] text-[#0E5145]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Política de privacidad (RGPD)
          </button>
          <button
            onClick={() => setActiveTab('boost_terms')}
            className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'boost_terms' ? 'border-[#146C5B] text-[#0E5145]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Términos de destacados y pagos
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'rules' ? 'border-[#146C5B] text-[#0E5145]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Reglas de publicación
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
          {activeTab === 'terms' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">1. Objeto y naturaleza del servicio</h4>
              <p>
                VecinoYa es un tablón y espacio digital de encuentro comunitario concebido para facilitar el contacto entre personas residentes en un mismo barrio o municipio que desean ofrecer o solicitar pequeños servicios y tareas cotidianas.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">2. Responsabilidad en la prestación</h4>
              <p>
                Los acuerdos sobre tarifas, horarios y realización de las tareas se convienen libre y directamente entre los usuarios involucrados. VecinoYa no actúa como empleador ni asume responsabilidad civil por la ejecución material de los trabajos pactados entre particulares.
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Protección de datos conforme al RGPD y LOPDGDD</h4>
              <p>
                En cumplimiento del Reglamento General de Protección de Datos (UE 2016/679), tus datos de contacto y perfil se tratan exclusivamente con la finalidad de gestionar tus publicaciones y la comunicación vecinal que tú autorices.
              </p>
              <p>
                • No cedemos ni comercializamos tus datos con terceros ni con redes publicitarias.<br/>
                • Tienes derecho de acceso, rectificación, supresión y limitación de tus datos en cualquier momento.<br/>
                • No se publican de forma abierta datos bancarios, contraseñas ni números de documento nacional de identidad.
              </p>
            </div>
          )}

          {activeTab === 'boost_terms' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Condiciones de los Servicios Destacados de Pago</h4>
              <p>
                VecinoYa pone a disposición de los usuarios cuatro modalidades de promoción temporal para mejorar la visibilidad de sus anuncios:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Plan Básico:</strong> 1,50 € (IVA incl.) — 3 días de duración.</li>
                <li><strong>Plan Intermedio:</strong> 3,00 € (IVA incl.) — 7 días de duración.</li>
                <li><strong>Plan Avanzado:</strong> 5,00 € (IVA incl.) — 15 días de duración.</li>
                <li><strong>Plan Premium:</strong> 8,00 € (IVA incl.) — 30 días de duración.</li>
              </ul>
              <h4 className="font-bold text-slate-900 text-sm">Expiración automática y no recurrencia</h4>
              <p>
                Al concluir el periodo contratado, el anuncio pasa automáticamente a estado estándar sin cargos ocultos ni renovaciones automáticas no consentidas. El usuario conserva su anuncio íntegro con independencia de si contrata un destacado.
              </p>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Reglas de publicación y convivencia vecinal</h4>
              <p>
                Para mantener un clima de respeto y confianza en el barrio, queda estrictamente prohibido:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Publicar anuncios con fines especulativos, fraudulentos o estafas piramidales.</li>
                <li>Ofrecer servicios que vulneren la legislación vigente o requieran colegiación médica no acreditada.</li>
                <li>Difundir datos de carácter personal de terceros sin su consentimiento explícito.</li>
                <li>Reiterar publicaciones duplicadas (spam masivo) para acaparar el listado.</li>
              </ul>
              <p>
                Los anuncios que infrinjan estas reglas serán suspendidos por los moderadores de la comunidad.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#146C5B] text-white font-semibold text-xs rounded-xl"
          >
            Cerrar información
          </button>
        </div>
      </div>
    </div>
  );
};
