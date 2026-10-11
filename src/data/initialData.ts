import { BoostPlan, Category, ServiceListing, User } from '../types';

export const BOOST_PLANS: BoostPlan[] = [
  {
    id: 'basico',
    name: 'Plan Básico',
    price: 1.50,
    durationDays: 3,
    badgeLabel: 'Destacado',
    tagline: 'Impulso rápido para servicios puntuales',
    benefits: [
      '3 días de visibilidad prioritaria',
      'Distintivo verde "Destacado" en la tarjeta',
      'Aparición por encima de anuncios estándar'
    ],
    priorityRank: 1
  },
  {
    id: 'intermedio',
    name: 'Plan Intermedio',
    price: 3.00,
    durationDays: 7,
    badgeLabel: 'Destacado+',
    tagline: 'Una semana completa al frente de tu barrio',
    benefits: [
      '7 días de posición preferente',
      'Prioridad media-alta en búsquedas y filtros',
      'Distintivo destacado en listados locales',
      'Hasta 2 veces más consultas de vecinos'
    ],
    priorityRank: 2
  },
  {
    id: 'avanzado',
    name: 'Plan Avanzado',
    price: 5.00,
    durationDays: 15,
    badgeLabel: 'Recomendado',
    tagline: 'Máxima visibilidad quincenal en tu zona',
    benefits: [
      '15 días en primeras posiciones de categoría y zona',
      'Distintivo plateado de recomendación vecinal',
      'Aparición en el carrusel de destacados de portada',
      'Mayor confianza y contacto directo rápido'
    ],
    priorityRank: 3
  },
  {
    id: 'premium',
    name: 'Plan Premium',
    price: 8.00,
    durationDays: 30,
    badgeLabel: 'Top Barrio',
    tagline: 'El mes completo en la cabecera de la comunidad',
    benefits: [
      '30 días en la posición de máxima relevancia',
      'Insignia dorada "Top Barrio" y sello de confianza',
      'Prioridad absoluta en búsquedas de zona',
      'Recomendación preferente a nuevos vecinos'
    ],
    priorityRank: 4
  }
];

export const CATEGORIES: Category[] = [
  {
    id: 'hogar',
    name: 'Hogar y reparaciones',
    slug: 'hogar-reparaciones',
    iconName: 'Wrench',
    description: 'Fontanería, electricidad, montaje de muebles y pequeños arreglos.'
  },
  {
    id: 'jardineria',
    name: 'Jardinería y terrenos',
    slug: 'jardineria-limpieza',
    iconName: 'Sprout',
    description: 'Cuidado de plantas, terrazas, huertos urbanos y desbroce.'
  },
  {
    id: 'mascotas',
    name: 'Cuidado de mascotas',
    slug: 'mascotas',
    iconName: 'Dog',
    description: 'Paseos diarios, cuidados por vacaciones y visitas a domicilio.'
  },
  {
    id: 'clases',
    name: 'Clases y estudios',
    slug: 'clases-estudios',
    iconName: 'GraduationCap',
    description: 'Apoyo escolar, idiomas, música e iniciación tecnológica.'
  },
  {
    id: 'tecnologia',
    name: 'Tecnología y digital',
    slug: 'tecnologia-digital',
    iconName: 'Laptop',
    description: 'Configuración de móviles, ordenadores, WiFi y trámites online.'
  },
  {
    id: 'recados',
    name: 'Recados y ayuda cotidiana',
    slug: 'recados-ayuda',
    iconName: 'ShoppingBag',
    description: 'Compras para personas mayores, recogida de paquetes y traslados.'
  },
  {
    id: 'otros',
    name: 'Otros servicios',
    slug: 'otros-servicios',
    iconName: 'Layers',
    description: 'Costura, acompañamiento, fotografía local y servicios varios.'
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'user_laura',
    name: 'Laura Martín',
    email: 'laura.martin@ejemplo.es',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    neighborhood: 'Centro / Plaza Mayor',
    city: 'Madrid',
    bio: 'Bióloga y aficionada a la botánica. Me encanta ayudar a vecinos a mantener vivas sus terrazas y huertos.',
    phone: '+34 612 345 678',
    role: 'user',
    joinedDate: 'Marzo 2024',
    isDemo: true,
    authProvider: 'demo'
  },
  {
    id: 'user_carlos',
    name: 'Carlos Romero',
    email: 'carlos.romero@ejemplo.es',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    neighborhood: 'Chamberí',
    city: 'Madrid',
    bio: 'Técnico de mantenimiento jubilado. Monto muebles IKEA, arreglos de persianas, grifos y enchufes.',
    phone: '+34 654 987 321',
    role: 'user',
    joinedDate: 'Enero 2024',
    isDemo: true,
    authProvider: 'demo'
  },
  {
    id: 'user_elena',
    name: 'Elena Gómez',
    email: 'elena.gomez@ejemplo.es',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    neighborhood: 'Retiro',
    city: 'Madrid',
    bio: 'Educadora canina y paseadora con 5 años de experiencia. Adoro a los perros y la naturaleza.',
    phone: '+34 678 123 456',
    role: 'user',
    joinedDate: 'Febrero 2024',
    isDemo: true,
    authProvider: 'demo'
  },
  {
    id: 'user_admin',
    name: 'Equipo VecinoYa (Admin Demo)',
    email: 'admin@vecinoya.local',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    neighborhood: 'Sede Central',
    city: 'Madrid',
    bio: 'Administración y moderación comunitaria de VecinoYa (demostración).',
    role: 'admin',
    joinedDate: 'Noviembre 2023',
    isDemo: true,
    authProvider: 'demo'
  }
];

export const INITIAL_SERVICES: ServiceListing[] = [
  {
    id: 'srv_1',
    title: 'Paseo responsable y cuidado cariñoso de perros',
    categoryId: 'mascotas',
    description: 'Paseo a tu perro por el parque en grupos reducidos o individuales. Cuento con formación en comportamiento canino positivo, agua fresca, juegos y reporte fotográfico diario por WhatsApp.',
    price: 12,
    priceType: 'hora',
    neighborhood: 'Retiro / Niño Jesús',
    city: 'Madrid',
    availability: 'Lunes a Viernes (Mañanas y Tardes)',
    imageUrl: '/src/assets/images/service_pet_care_1791572277371.jpg',
    contactMethod: 'whatsapp',
    contactValue: '+34 678 123 456',
    additionalNotes: 'Llevo bolsas biodegradables y premios naturales aptos para intolerancias.',
    authorId: 'user_elena',
    authorName: 'Elena Gómez',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    authorRating: 4.9,
    authorReviewCount: 28,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: 'active',
    isFeatured: true,
    featuredPlanId: 'premium',
    featuredPlanName: 'Plan Premium',
    featuredUntil: new Date(Date.now() + 25 * 86400000).toISOString(),
    reportCount: 0
  },
  {
    id: 'srv_2',
    title: 'Pequeñas reparaciones del hogar, fontanería y bricolaje',
    categoryId: 'hogar',
    description: 'Arreglo grifos que gotean, cambio de cisternas, instalación de lámparas, enchufes, cuelgo cuadros y monto muebles kit. Presupuesto sin compromiso y herramientas propias.',
    price: 18,
    priceType: 'hora',
    neighborhood: 'Chamberí / Trafalgar',
    city: 'Madrid',
    availability: 'Lunes a Sábado (Flexible)',
    imageUrl: '/src/assets/images/service_home_repairs_1791572265993.jpg',
    contactMethod: 'whatsapp',
    contactValue: '+34 654 987 321',
    additionalNotes: 'Cobro por horas reales trabajadas o precio cerrado antes de empezar.',
    authorId: 'user_carlos',
    authorName: 'Carlos Romero',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    authorRating: 5.0,
    authorReviewCount: 42,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    status: 'active',
    isFeatured: true,
    featuredPlanId: 'avanzado',
    featuredPlanName: 'Plan Avanzado',
    featuredUntil: new Date(Date.now() + 10 * 86400000).toISOString(),
    reportCount: 0
  },
  {
    id: 'srv_3',
    title: 'Mantenimiento de plantas de terraza, poda y riego en vacaciones',
    categoryId: 'jardineria',
    description: 'Asesoramiento botánico para balcones y terrazas. Trasplante de macetas, tratamiento orgánico contra plagas, poda de rosales y sistema de riego automático casero para tus vacaciones.',
    price: 15,
    priceType: 'hora',
    neighborhood: 'Centro / La Latina',
    city: 'Madrid',
    availability: 'Tardes y Fines de semana',
    imageUrl: '/src/assets/images/service_gardening_1791572287879.jpg',
    contactMethod: 'chat',
    contactValue: 'laura.martin@ejemplo.es',
    additionalNotes: 'Puedo aportar compost orgánico y sustrato mineral.',
    authorId: 'user_laura',
    authorName: 'Laura Martín',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    authorRating: 4.8,
    authorReviewCount: 19,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    status: 'active',
    isFeatured: true,
    featuredPlanId: 'intermedio',
    featuredPlanName: 'Plan Intermedio',
    featuredUntil: new Date(Date.now() + 5 * 86400000).toISOString(),
    reportCount: 0
  },
  {
    id: 'srv_4',
    title: 'Clases particulares de Matemáticas y Física (ESO y Bachillerato)',
    categoryId: 'clases',
    description: 'Graduado en Ingeniería Industrial ofrece apoyo pedagógico individualizado. Explicaciones claras con ejercicios prácticos y técnicas de estudio para superar exámenes con seguridad.',
    price: 16,
    priceType: 'hora',
    neighborhood: 'Salamanca / Guindalera',
    city: 'Madrid',
    availability: 'Lunes a Jueves (16:00 a 20:30)',
    imageUrl: '/src/assets/images/service_tutoring_1791572297829.jpg',
    contactMethod: 'phone',
    contactValue: '+34 633 445 566',
    additionalNotes: 'Primera sesión diagnóstica gratuita de 30 minutos.',
    authorId: 'user_carlos',
    authorName: 'Carlos Romero',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    authorRating: 4.9,
    authorReviewCount: 14,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    status: 'active',
    isFeatured: false,
    reportCount: 0
  },
  {
    id: 'srv_5',
    title: 'Ayuda tecnológica para mayores y trámites con certificado digital',
    categoryId: 'tecnologia',
    description: 'Paciencia y cercanía para resolver dudas con el smartphone, configuración de WhatsApp, copias de seguridad de fotos, banca electrónica segura y trámites con Cl@ve PIN.',
    price: 14,
    priceType: 'hora',
    neighborhood: 'Centro / Malasaña',
    city: 'Madrid',
    availability: 'Mañanas de Lunes a Viernes',
    imageUrl: '/src/assets/images/hero_neighborhood_community_1791572255971.jpg',
    contactMethod: 'phone',
    contactValue: '+34 611 223 344',
    additionalNotes: 'Sesiones presenciales en el domicilio del vecino.',
    authorId: 'user_laura',
    authorName: 'Laura Martín',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    authorRating: 5.0,
    authorReviewCount: 31,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    status: 'active',
    isFeatured: false,
    reportCount: 0
  },
  {
    id: 'srv_6',
    title: 'Ayuda con compras pesadas y recados vecinales para mayores',
    categoryId: 'recados',
    description: 'Acompañamiento a citas médicas, compras en el mercado del barrio, recogida de medicamentos en farmacia y recados cotidianos con puntualidad y trato afectuoso.',
    price: 10,
    priceType: 'hora',
    neighborhood: 'Arganzuela / Delicias',
    city: 'Madrid',
    availability: 'Mañanas y Tardes',
    imageUrl: '/src/assets/images/hero_neighborhood_community_1791572255971.jpg',
    contactMethod: 'whatsapp',
    contactValue: '+34 688 990 011',
    additionalNotes: 'Vivo en el barrio desde hace 10 años, referencias disponibles.',
    authorId: 'user_elena',
    authorName: 'Elena Gómez',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    authorRating: 4.9,
    authorReviewCount: 16,
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    status: 'active',
    isFeatured: false,
    reportCount: 0
  }
];
