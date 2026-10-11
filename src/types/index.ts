export type PriceType = 'hora' | 'trabajo' | 'a_convenir';

export interface BoostPlan {
  id: 'basico' | 'intermedio' | 'avanzado' | 'premium';
  name: string;
  price: number; // in EUR: 1.50, 3.00, 5.00, 8.00
  durationDays: number;
  badgeLabel: string;
  tagline: string;
  benefits: string[];
  priorityRank: number; // higher = sorted first
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  description: string;
}

export type ContactMethod = 'whatsapp' | 'phone' | 'chat' | 'email';

export interface ServiceListing {
  id: string;
  title: string;
  categoryId: string;
  description: string;
  price: number;
  priceType: PriceType;
  neighborhood: string;
  city: string;
  availability: string;
  imageUrl: string;
  contactMethod: ContactMethod;
  contactValue: string;
  additionalNotes?: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRating: number;
  authorReviewCount: number;
  createdAt: string;
  /** Editorial / moderation status: 'active' (published), 'draft' (editorial draft), 'suspended' (moderated) */
  status: 'active' | 'suspended' | 'draft';
  /** Temporary visibility derived from whether the owner has an active authenticated session */
  ownerSessionActive?: boolean;
  isFeatured: boolean;
  featuredPlanId?: string;
  featuredUntil?: string; // ISO Date string
  featuredPlanName?: string;
  reportCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  neighborhood: string;
  city: string;
  bio: string;
  phone?: string;
  role: 'user' | 'admin';
  joinedDate: string;
  isDemo?: boolean;
  authProvider?: 'supabase' | 'demo';
  emailConfirmed?: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpData extends AuthCredentials {
  name: string;
  neighborhood: string;
  city?: string;
  phone?: string;
}

export interface UserProfileUpdate {
  name?: string;
  phone?: string;
  neighborhood?: string;
  city?: string;
  bio?: string;
  avatar?: string;
}

export interface PaymentTransaction {
  id: string;
  serviceId: string;
  serviceTitle: string;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  createdAt: string;
  expiresAt: string;
  referenceCode: string;
  provider: 'stripe_gateway' | 'redsys_gateway' | 'simulated_secure';
}

export interface ReportItem {
  id: string;
  serviceId: string;
  serviceTitle: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export interface ChatMessage {
  id: string;
  serviceId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}
