import React from 'react';
import { Search, MessageSquare, HeartHandshake, ShieldCheck } from 'lucide-react';

interface HowItWorksProps {
  onOpenPublish: () => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ onOpenPublish }) => {
  const steps = [
    {
      num: '01',
      title: 'Busca o publica tu servicio',
      desc: 'Explora categorías desde reparaciones caseras hasta paseo de perros, o crea tu anuncio en 2 minutos para ofrecer tu ayuda.',
      icon: Search
    },
    {
      num: '02',
      title: 'Conecta con confianza vecinal',
      desc: 'Contacta por chat o WhatsApp directamente con tu vecino, revisa valoraciones previas y acuerda los detalles sin comisiones ocultas.',
      icon: MessageSquare
    },
    {
      num: '03',
      title: 'Haz barrio y apoya lo local',
      desc: 'Fomenta la economía circular de proximidad, soluciona tus tareas cotidianas y fortalece los lazos de tu comunidad.',
      icon: HeartHandshake
    }
  ];

  return (
    <section className="py-14 bg-white border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#146C5B]">
            Simple, seguro y cercano
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0E5145] tracking-tight">
            ¿Cómo funciona VecinoYa?
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Una plataforma pensada por y para vecinos, para que resolver las cosas del día a día sea tan fácil como cruzar la acera.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="relative p-6 rounded-2xl bg-[#F7F9F8] border border-slate-200/90 flex flex-col justify-between space-y-4 hover:border-[#146C5B]/40 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#E5F3EF] text-[#146C5B] flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-black text-slate-300 tabular-nums">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-4 rounded-xl bg-[#E5F3EF]/50 border border-[#146C5B]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#146C5B] shrink-0" />
            <span>
              <strong>Tu privacidad es lo primero:</strong> No mostramos direcciones exactas ni teléfonos personales a personas no verificadas.
            </span>
          </div>
          <button
            onClick={onOpenPublish}
            className="px-4 py-2 bg-[#146C5B] text-white hover:bg-[#0E5145] font-semibold rounded-xl shrink-0 transition-colors cursor-pointer"
          >
            Publicar un servicio ahora
          </button>
        </div>
      </div>
    </section>
  );
};
