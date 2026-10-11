import React from 'react';
import { BrandLogo } from './BrandLogo';
import { Heart, ShieldCheck, HelpCircle, FileText, Lock } from 'lucide-react';

interface FooterProps {
  onOpenHowItWorks: () => void;
  onOpenPlans: () => void;
  onOpenLegal: (tab: 'terms' | 'privacy' | 'boost_terms' | 'rules') => void;
  onOpenPublish: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenHowItWorks,
  onOpenPlans,
  onOpenLegal,
  onOpenPublish,
}) => {
  return (
    <footer className="bg-white border-t border-slate-200/80 pt-12 pb-16 lg:pb-12 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-slate-100">
          
          {/* Brand info */}
          <div className="lg:col-span-2 space-y-3">
            <BrandLogo size="md" showTagline={true} />
            <p className="text-slate-500 max-w-sm leading-relaxed mt-2">
              VecinoYa es la plataforma de proximidad para compartir habilidades, encontrar ayuda en tareas cotidianas y construir un barrio más solidario y cercano.
            </p>
            <div className="flex items-center gap-2 pt-1 text-slate-500">
              <span className="font-semibold text-[#146C5B]">Vecindario consciente</span>
              <span>·</span>
              <span>Economía local</span>
            </div>
          </div>

          {/* Column 1: Plataforma */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Plataforma
            </h5>
            <ul className="space-y-2 text-slate-600">
              <li>
                <a href="#servicios" className="hover:text-[#146C5B] transition-colors">
                  Explorar todos los servicios
                </a>
              </li>
              <li>
                <button onClick={onOpenHowItWorks} className="hover:text-[#146C5B] transition-colors text-left">
                  Cómo funciona VecinoYa
                </button>
              </li>
              <li>
                <button onClick={onOpenPublish} className="hover:text-[#146C5B] transition-colors text-left font-semibold text-[#146C5B]">
                  Publicar un servicio
                </button>
              </li>
              <li>
                <button onClick={onOpenPlans} className="hover:text-[#146C5B] transition-colors text-left">
                  Planes de visibilidad destacada
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Destacados y planes */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Planes Destacados
            </h5>
            <ul className="space-y-2 text-slate-600">
              <li>
                <button onClick={onOpenPlans} className="hover:text-[#146C5B] transition-colors text-left">
                  Plan Básico (1,50 € / 3 días)
                </button>
              </li>
              <li>
                <button onClick={onOpenPlans} className="hover:text-[#146C5B] transition-colors text-left">
                  Plan Intermedio (3,00 € / 7 días)
                </button>
              </li>
              <li>
                <button onClick={onOpenPlans} className="hover:text-[#146C5B] transition-colors text-left">
                  Plan Avanzado (5,00 € / 15 días)
                </button>
              </li>
              <li>
                <button onClick={onOpenPlans} className="hover:text-[#146C5B] transition-colors text-left">
                  Plan Premium (8,00 € / 30 días)
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal y Seguridad */}
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Seguridad y Legal
            </h5>
            <ul className="space-y-2 text-slate-600">
              <li>
                <button onClick={() => onOpenLegal('terms')} className="hover:text-[#146C5B] transition-colors text-left">
                  Condiciones de uso
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('privacy')} className="hover:text-[#146C5B] transition-colors text-left">
                  Política de privacidad (RGPD)
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('boost_terms')} className="hover:text-[#146C5B] transition-colors text-left">
                  Términos de pagos y destacados
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('rules')} className="hover:text-[#146C5B] transition-colors text-left">
                  Normas de convivencia comunitaria
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <p>© {new Date().getFullYear()} VecinoYa. Todos los derechos reservados. "Juntos hacemos barrio".</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#146C5B]" />
              Conexión segura y cifrada
            </span>
            <span>·</span>
            <span>Cumplimiento RGPD</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
