import {
  BOOST_PLANS,
  CATEGORIES
} from '../data/initialData';
import {
  BoostPlan,
  Category,
  ChatMessage,
  PaymentTransaction,
  ReportItem,
  ServiceListing
} from '../types';
import {
  isSupabaseConfigured,
  supabase,
  ensureSupabaseClient,
  mapRowToService,
  buildClientInsertRow,
  buildClientUpdateRow,
  ServiceRow
} from './supabase';

const SERVICES_KEY = 'vecinoya_services_v2';
const FAVORITES_KEY = 'vecinoya_favorites_v2';
const TRANSACTIONS_KEY = 'vecinoya_transactions_v2';
const REPORTS_KEY = 'vecinoya_reports_v2';
const CURRENT_USER_KEY = 'vecinoya_current_user_v2';
const CHAT_KEY = 'vecinoya_chats_v2';
const DISCONNECTED_AUTHORS_KEY = 'vecinoya_disconnected_authors_v1';
const USER_OWN_SERVICES_PREFIX = 'vecinoya_user_services_backup_v1_';
const PENDING_REMOTE_SYNC_PREFIX = 'vecinoya_pending_remote_sync_v1_';

export const SERVICES_VISIBILITY_EVENT = 'vecinoya:services-visibility-changed';

export interface SupabaseStructuredError {
  code: string;
  message: string;
  details: string | null;
  hint?: string | null;
}

export interface CreateServiceRemoteResult {
  success: boolean;
  syncedWithSupabase: boolean;
  service: ServiceListing;
  error?: string;
  supabaseError?: SupabaseStructuredError;
}

const PREVIEW_PERSONA_KEY = 'vecinoya_preview_persona_v2';
const LEGACY_DEMO_USER_ID_PATTERN = /^user_(laura|carlos|elena|admin)$/;
const LEGACY_DEMO_SERVICE_ID_PATTERN = /^srv_[1-6]$/;
const LEGACY_DEMO_TX_ID_PATTERN = /^tx_seed_[1-2]$/;

function sanitizeErrorText(text: unknown): string {
  if (!text) return '';
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/sb_secret_[A-Za-z0-9\-_]+/gi, '[REDACTED]')
    .replace(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[REDACTED_JWT]');
}

export function extractSupabaseStructuredError(
  error: any,
  fallbackCode = 'SUPABASE_INSERT_ERROR'
): SupabaseStructuredError {
  const code = sanitizeErrorText(error?.code || error?.status || fallbackCode) || fallbackCode;
  const message =
    sanitizeErrorText(error?.message || error?.error_description || 'Error al insertar el anuncio en Supabase.') ||
    'Error al insertar el anuncio en Supabase.';
  const details = error?.details ? sanitizeErrorText(error.details) : null;
  const hint = error?.hint ? sanitizeErrorText(error.hint) : null;
  return {
    code,
    message,
    details,
    hint
  };
}

export function formatStructuredSupabaseError(err: SupabaseStructuredError): string {
  const parts = [`[${err.code}] ${err.message}`];
  if (err.details) {
    parts.push(`Detalles: ${err.details}`);
  }
  if (err.hint) {
    parts.push(`Sugerencia: ${err.hint}`);
  }
  return parts.join(' — ');
}

function notifyServicesVisibilityChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SERVICES_VISIBILITY_EVENT));
  }
}

export function isDemoAuthorId(authorId: string): boolean {
  return LEGACY_DEMO_USER_ID_PATTERN.test(authorId || '');
}

export function isDemoServiceId(serviceId: string): boolean {
  return LEGACY_DEMO_SERVICE_ID_PATTERN.test(serviceId || '');
}

function isDemoTransactionRecord(tx: Partial<PaymentTransaction> | null | undefined): boolean {
  if (!tx || typeof tx !== 'object') return true;
  if (LEGACY_DEMO_TX_ID_PATTERN.test(String(tx.id || ''))) return true;
  if (tx.provider === 'simulated_secure') return true;
  if (isDemoServiceId(String(tx.serviceId || ''))) return true;
  if (isDemoAuthorId(String(tx.userId || ''))) return true;
  return false;
}

/**
 * Purges only unequivocally identified demo records from localStorage while preserving
 * all authentic user data, real services, real transactions, favorites, reports, and chats.
 */
export function purgeLegacyDemoStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  try {
    // 1. Remove demo persona switcher key
    localStorage.removeItem(PREVIEW_PERSONA_KEY);

    // 2. Clean vecinoya_current_user_v2 only if it belongs to a demo persona
    const rawUser = localStorage.getItem(CURRENT_USER_KEY);
    if (rawUser) {
      try {
        const parsedUser = JSON.parse(rawUser);
        if (
          !parsedUser ||
          parsedUser.isDemo === true ||
          parsedUser.authProvider === 'demo' ||
          isDemoAuthorId(String(parsedUser.id || ''))
        ) {
          localStorage.removeItem(CURRENT_USER_KEY);
        }
      } catch {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }

    // 3. Clean vecinoya_services_v2 of seed ads (srv_1..srv_6) and demo authors
    const rawServices = localStorage.getItem(SERVICES_KEY);
    if (rawServices) {
      try {
        const parsedServices = JSON.parse(rawServices);
        if (Array.isArray(parsedServices)) {
          const realServices = parsedServices.filter(
            s => s && s.id && !isDemoServiceId(String(s.id)) && !isDemoAuthorId(String(s.authorId || ''))
          );
          if (realServices.length !== parsedServices.length) {
            localStorage.setItem(SERVICES_KEY, JSON.stringify(realServices));
          }
        }
      } catch {
        // preserve if unreadable
      }
    }

    // 4. Clean vecinoya_transactions_v2 of simulated seed transactions (tx_seed_1, tx_seed_2)
    const rawTx = localStorage.getItem(TRANSACTIONS_KEY);
    if (rawTx) {
      try {
        const parsedTx = JSON.parse(rawTx);
        if (Array.isArray(parsedTx)) {
          const realTx = parsedTx.filter(tx => !isDemoTransactionRecord(tx));
          if (realTx.length !== parsedTx.length) {
            localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(realTx));
          }
        }
      } catch {
        // preserve if unreadable
      }
    }

    // 5. Clean vecinoya_favorites_v2 of seed service IDs
    const rawFavs = localStorage.getItem(FAVORITES_KEY);
    if (rawFavs) {
      try {
        const parsedFavs = JSON.parse(rawFavs);
        if (Array.isArray(parsedFavs)) {
          const realFavs = parsedFavs.filter(id => typeof id === 'string' && !isDemoServiceId(id));
          if (realFavs.length !== parsedFavs.length) {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(realFavs));
          }
        }
      } catch {
        // ignore
      }
    }

    // 6. Clean vecinoya_reports_v2 of reports targeting seed ads or created by demo users
    const rawReports = localStorage.getItem(REPORTS_KEY);
    if (rawReports) {
      try {
        const parsedReports = JSON.parse(rawReports);
        if (Array.isArray(parsedReports)) {
          const realReports = parsedReports.filter(
            r =>
              r &&
              !isDemoServiceId(String(r.serviceId || '')) &&
              !isDemoAuthorId(String(r.reporterId || ''))
          );
          if (realReports.length !== parsedReports.length) {
            localStorage.setItem(REPORTS_KEY, JSON.stringify(realReports));
          }
        }
      } catch {
        // ignore
      }
    }

    // 7. Clean vecinoya_chats_v2 of messages targeting seed ads or demo users
    const rawChats = localStorage.getItem(CHAT_KEY);
    if (rawChats) {
      try {
        const parsedChats = JSON.parse(rawChats);
        if (Array.isArray(parsedChats)) {
          const realChats = parsedChats.filter(
            m =>
              m &&
              !isDemoServiceId(String(m.serviceId || '')) &&
              !isDemoAuthorId(String(m.senderId || ''))
          );
          if (realChats.length !== parsedChats.length) {
            localStorage.setItem(CHAT_KEY, JSON.stringify(realChats));
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore storage access errors
  }
}

purgeLegacyDemoStorage();

export function getDisconnectedAuthors(): string[] {
  try {
    const raw = localStorage.getItem(DISCONNECTED_AUTHORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDisconnectedAuthors(authorIds: string[]): void {
  try {
    const unique = Array.from(new Set(authorIds.filter(Boolean)));
    localStorage.setItem(DISCONNECTED_AUTHORS_KEY, JSON.stringify(unique));
  } catch {
    // ignore
  }
}

export function markAuthorDisconnected(authorId: string): void {
  if (!authorId) return;
  const current = getDisconnectedAuthors();
  if (!current.includes(authorId)) {
    saveDisconnectedAuthors([...current, authorId]);
  }
}

export function markAuthorConnected(authorId: string): void {
  if (!authorId) return;
  const current = getDisconnectedAuthors();
  if (current.includes(authorId)) {
    saveDisconnectedAuthors(current.filter(id => id !== authorId));
  }
}

export function isAuthorDisconnected(authorId: string, activeAuthUserId?: string | null): boolean {
  if (!authorId) return true;
  if (activeAuthUserId && authorId === activeAuthUserId) {
    return false;
  }
  const disconnected = getDisconnectedAuthors();
  return disconnected.includes(authorId);
}

function getPendingRemoteServiceIds(userId: string): string[] {
  if (!userId || isDemoAuthorId(userId)) return [];
  try {
    const raw = localStorage.getItem(`${PENDING_REMOTE_SYNC_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function markServicePendingRemoteSync(userId: string, serviceId: string): void {
  if (!userId || !serviceId || isDemoAuthorId(userId)) return;
  try {
    const existing = getPendingRemoteServiceIds(userId);
    if (!existing.includes(serviceId)) {
      localStorage.setItem(
        `${PENDING_REMOTE_SYNC_PREFIX}${userId}`,
        JSON.stringify([serviceId, ...existing])
      );
    }
  } catch {
    // ignore
  }
}

function clearServicePendingRemoteSync(userId: string, serviceId: string): void {
  if (!userId || !serviceId) return;
  try {
    const existing = getPendingRemoteServiceIds(userId);
    if (existing.includes(serviceId)) {
      localStorage.setItem(
        `${PENDING_REMOTE_SYNC_PREFIX}${userId}`,
        JSON.stringify(existing.filter(id => id !== serviceId))
      );
    }
  } catch {
    // ignore
  }
}

function getUserBackupServices(userId: string): ServiceListing[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${USER_OWN_SERVICES_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUserBackupServices(userId: string, services: ServiceListing[]): void {
  if (!userId) return;
  try {
    const uniqueMap = new Map<string, ServiceListing>();
    for (const s of services) {
      if (s.authorId === userId && !isDemoAuthorId(s.authorId)) {
        uniqueMap.set(s.id, s);
      }
    }
    localStorage.setItem(
      `${USER_OWN_SERVICES_PREFIX}${userId}`,
      JSON.stringify(Array.from(uniqueMap.values()))
    );
  } catch {
    // ignore
  }
}

function removeServiceFromUserBackup(userId: string, serviceId: string): void {
  if (!userId || !serviceId) return;
  clearServicePendingRemoteSync(userId, serviceId);
  const existing = getUserBackupServices(userId);
  if (existing.length > 0) {
    saveUserBackupServices(
      userId,
      existing.filter(s => s.id !== serviceId)
    );
  }
}

/**
 * Sync disconnected author IDs from the backend server (/api/session/presence)
 */
export async function syncDisconnectedAuthorsFromServer(activeAuthUserId?: string | null): Promise<string[]> {
  try {
    const res = await fetch('/api/session/presence');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.disconnectedAuthorIds)) {
        const merged = new Set<string>([
          ...getDisconnectedAuthors(),
          ...data.disconnectedAuthorIds
        ]);
        if (activeAuthUserId) {
          merged.delete(activeAuthUserId);
        }
        const finalIds = Array.from(merged);
        saveDisconnectedAuthors(finalIds);
        return finalIds;
      }
    }
  } catch {
    // Fallback to local disconnected list if offline
  }
  return getDisconnectedAuthors();
}

/**
 * Filter a list of services so ONLY publicly visible services from connected owners are returned:
 * - Editorial status MUST be 'active' (editorial 'draft' and 'suspended' are NEVER shown publicly)
 * - Session visibility (`ownerSessionActive`) MUST not be false, and owner must not be disconnected
 * - When Supabase is configured, unauthenticated demo seed authors are excluded
 * - Deduplicated by service.id
 */
export function getPublicVisibleServices(
  services: ServiceListing[],
  activeAuthUserId?: string | null
): ServiceListing[] {
  const disconnectedSet = new Set(getDisconnectedAuthors());
  if (activeAuthUserId) {
    disconnectedSet.delete(activeAuthUserId);
  }

  const uniqueMap = new Map<string, ServiceListing>();
  for (const service of services) {
    if (!service || !service.id) continue;
    // When Supabase is configured, exclude hardcoded demo services whose demo authors have no real session
    if (isSupabaseConfigured && isDemoAuthorId(service.authorId)) {
      continue;
    }
    // 1. Editorial status check: ONLY published ('active') listings can appear publicly (never 'draft' or 'suspended')
    if (service.status !== 'active') {
      continue;
    }
    // 2. Session visibility check: owner must have an active session (`ownerSessionActive !== false`)
    const isCurrentActiveOwner = Boolean(activeAuthUserId && service.authorId === activeAuthUserId);
    if (!isCurrentActiveOwner && service.ownerSessionActive === false) {
      continue;
    }
    if (disconnectedSet.has(service.authorId)) {
      continue;
    }
    if (!uniqueMap.has(service.id)) {
      uniqueMap.set(service.id, {
        ...service,
        ownerSessionActive: true
      });
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Returns all services owned by the currently authenticated user (including both
 * published 'active' listings and editorial 'draft' listings) for management in their private profile.
 */
export function getOwnerServices(
  services: ServiceListing[],
  activeAuthUserId?: string | null
): ServiceListing[] {
  if (!activeAuthUserId || isDemoAuthorId(activeAuthUserId)) {
    return [];
  }
  const uniqueMap = new Map<string, ServiceListing>();
  const backup = getUserBackupServices(activeAuthUserId);
  for (const s of [...services, ...backup]) {
    if (s && s.id && s.authorId === activeAuthUserId && !uniqueMap.has(s.id)) {
      uniqueMap.set(s.id, s);
    }
  }
  return Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Helper to check and expire featured status (pure transformation without overwriting public cache directly)
export function checkExpiration(services: ServiceListing[]): ServiceListing[] {
  const now = new Date();

  return services.map(service => {
    if (service.isFeatured && service.featuredUntil) {
      const expiry = new Date(service.featuredUntil);
      if (expiry <= now) {
        return {
          ...service,
          isFeatured: false,
          featuredPlanId: undefined,
          featuredPlanName: undefined
        };
      }
    }
    return service;
  });
}

function readRawCachedServices(): ServiceListing[] {
  try {
    const raw = localStorage.getItem(SERVICES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ServiceListing[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(
      s => s && s.id && !isDemoServiceId(s.id) && !isDemoAuthorId(s.authorId)
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(SERVICES_KEY, JSON.stringify(cleaned));
    }
    return checkExpiration(cleaned);
  } catch (err) {
    console.error('Error reading services from localStorage:', err);
    return [];
  }
}

// Synchronous local storage read filtered by session visibility rules (plus owner's own rows when logged in)
export function getServices(activeAuthUserId?: string | null): ServiceListing[] {
  const rawList = readRawCachedServices();
  const publicList = getPublicVisibleServices(rawList, activeAuthUserId);
  if (!activeAuthUserId) {
    return publicList;
  }
  const ownerList = getOwnerServices(rawList, activeAuthUserId);
  const merged = new Map<string, ServiceListing>();
  for (const s of [...ownerList, ...publicList]) {
    if (!merged.has(s.id)) {
      merged.set(s.id, s);
    }
  }
  return Array.from(merged.values());
}

// Synchronous local storage save (deduplicated by ID, excluding demo seed items)
export function saveServices(services: ServiceListing[]): void {
  try {
    const uniqueMap = new Map<string, ServiceListing>();
    for (const s of services) {
      if (s && s.id) {
        if (isDemoServiceId(s.id) || isDemoAuthorId(s.authorId)) {
          continue;
        }
        uniqueMap.set(s.id, s);
      }
    }
    localStorage.setItem(SERVICES_KEY, JSON.stringify(Array.from(uniqueMap.values())));
  } catch (err) {
    console.error('Error saving services to localStorage:', err);
  }
}

/**
 * Synchronize the temporary session visibility (`ownerSessionActive`) of a user's services
 * when their session starts or ends, WITHOUT ever altering their editorial `status` ('active' | 'draft').
 */
export async function setUserServicesVisibilityRemote(
  userId: string,
  isOnline: boolean,
  accessToken?: string
): Promise<void> {
  if (!userId || isDemoAuthorId(userId)) return;

  if (!isOnline) {
    // 1. Mark author disconnected locally immediately
    markAuthorDisconnected(userId);

    // 2. Back up the user's own services preserving their exact editorial status ('active' | 'draft' | 'suspended')
    const currentCached = readRawCachedServices();
    const userOwnedInCache = currentCached.filter(s => s.authorId === userId);
    if (userOwnedInCache.length > 0) {
      const existingBackup = getUserBackupServices(userId);
      const mergedBackup = new Map<string, ServiceListing>();
      for (const s of [...existingBackup, ...userOwnedInCache]) {
        mergedBackup.set(s.id, {
          ...s,
          status: s.status,
          ownerSessionActive: false
        });
      }
      saveUserBackupServices(userId, Array.from(mergedBackup.values()));
    }

    const remainingPublic = currentCached.filter(
      s =>
        s.authorId !== userId &&
        s.status === 'active' &&
        s.ownerSessionActive !== false &&
        !isAuthorDisconnected(s.authorId)
    );
    saveServices(remainingPublic);
    notifyServicesVisibilityChanged();

    // 3. Notify backend presence registry with verified Bearer token
    if (accessToken) {
      try {
        await fetch('/api/session/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ online: false })
        });
      } catch {
        // ignore network error
      }
    }
    notifyServicesVisibilityChanged();
    return;
  }

  // isOnline === true (User signed in or has a valid active Supabase Auth session)
  markAuthorConnected(userId);

  // 1. Notify backend presence registry
  let tokenToUse = accessToken;
  if (!tokenToUse && isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      tokenToUse = data.session?.access_token;
    } catch {
      // ignore
    }
  }

  if (tokenToUse) {
    try {
      await fetch('/api/session/presence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`
        },
        body: JSON.stringify({ online: true })
      });
    } catch {
      // ignore
    }
  }

  // 2. Restore backed-up user services preserving their exact editorial `status` ('active' vs 'draft')
  const backupServices = getUserBackupServices(userId);
  if (backupServices.length > 0) {
    const restoredBackup = backupServices.map(s => ({
      ...s,
      status: s.status, // NEVER convert 'draft' to 'active'
      ownerSessionActive: true
    }));
    saveUserBackupServices(userId, restoredBackup);

    const currentCached = readRawCachedServices();
    const mergedMap = new Map<string, ServiceListing>();
    // Only add editorial 'active' listings to the public cache
    for (const s of restoredBackup) {
      if (s.status === 'active') {
        mergedMap.set(s.id, s);
      }
    }
    for (const s of currentCached) {
      if (!mergedMap.has(s.id)) {
        mergedMap.set(s.id, s);
      }
    }
    saveServices(getPublicVisibleServices(Array.from(mergedMap.values()), userId));
  }

  notifyServicesVisibilityChanged();
}

/**
 * Asynchronously fetch services from Supabase.
 * - Confirmed remote rows from `public.services` are the primary source of truth.
 * - Preserves local unconfirmed/pending services of the authenticated owner so `localStorage`
 *   is never overwritten with an empty array `[]` if a remote insert failed or is not yet confirmed.
 * - Keeps editorial drafts (`status = 'draft'`) and suspended services (`status = 'suspended'`) hidden from the public.
 */
export async function fetchServicesFromRemote(activeAuthUserId?: string | null): Promise<ServiceListing[]> {
  const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
  let effectiveAuthUserId = activeAuthUserId;
  if (effectiveAuthUserId === undefined && client) {
    try {
      const { data: sessionData } = await client.auth.getSession();
      effectiveAuthUserId = sessionData?.session?.user?.id || null;
    } catch {
      effectiveAuthUserId = null;
    }
  }

  if (effectiveAuthUserId && isDemoAuthorId(effectiveAuthUserId)) {
    effectiveAuthUserId = null;
  }

  if (effectiveAuthUserId) {
    markAuthorConnected(effectiveAuthUserId);
  }

  await syncDisconnectedAuthorsFromServer(effectiveAuthUserId);

  if (!client) {
    return getServices(effectiveAuthUserId);
  }

  try {
    // Query only the verified columns of `public.services` (`status` and `author_id`)
    let query = client.from('services').select('*');
    if (effectiveAuthUserId) {
      query = query.or(`status.eq.active,author_id.eq.${effectiveAuthUserId}`);
    } else {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch returned error, falling back to filtered local cache:', error.message);
      return getServices(effectiveAuthUserId);
    }

    const rows = Array.isArray(data) ? (data as ServiceRow[]) : [];
    const uniqueRemoteMap = new Map<string, ServiceListing>();
    for (const row of rows) {
      if (row && row.id) {
        if (isDemoAuthorId(row.author_id)) continue;
        // Remote row from `public.services` is strictly authoritative for all 26 columns
        uniqueRemoteMap.set(row.id, mapRowToService(row));
      }
    }

    const confirmedRemote = checkExpiration(Array.from(uniqueRemoteMap.values()));

    // Clear any legacy pending status markers for the authenticated user
    if (effectiveAuthUserId) {
      for (const pendingId of getPendingRemoteServiceIds(effectiveAuthUserId)) {
        clearServicePendingRemoteSync(effectiveAuthUserId, pendingId);
      }
      const ownRemote = confirmedRemote.filter(s => s.authorId === effectiveAuthUserId);
      saveUserBackupServices(effectiveAuthUserId, ownRemote);
    }

    const publicVisible = getPublicVisibleServices(confirmedRemote, effectiveAuthUserId);

    // Always synchronize local public cache with the authoritative Supabase state (including empty array if all ads were deleted/suspended)
    saveServices(publicVisible);

    // Return public visible services + authenticated owner's own services (so profile can show owner's drafts/suspended)
    if (effectiveAuthUserId) {
      const resultMap = new Map<string, ServiceListing>();
      for (const s of [
        ...publicVisible,
        ...confirmedRemote.filter(item => item.authorId === effectiveAuthUserId)
      ]) {
        if (!resultMap.has(s.id)) {
          resultMap.set(s.id, s);
        }
      }
      return Array.from(resultMap.values());
    }

    return publicVisible;
  } catch (err) {
    console.warn('Network error while querying Supabase, using filtered local fallback:', err);
    return getServices(effectiveAuthUserId);
  }
}

/**
 * Create a new service (either published 'active' or editorial 'draft') in Supabase and local cache.
 * - Verifies active Supabase Auth session (`auth.uid()`) and checks `author_id === auth.uid()`.
 * - Never declares a service synchronized with Supabase until the remote `INSERT` is confirmed.
 * - Preserves structured error `{ code, message, details, hint }` without logging keys or tokens.
 * - Uses the exact 17-column client INSERT whitelist for `public.services`.
 */
export async function createServiceRemote(
  service: ServiceListing,
  expectedAuthorId?: string
): Promise<CreateServiceRemoteResult> {
  const editorialStatus: 'active' | 'draft' | 'suspended' =
    service.status === 'draft' ? 'draft' : 'active';

  const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
  if (client) {
    try {
      // 1. Verify real authenticated Supabase session and auth.uid()
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      const sessionUser = sessionData?.session?.user;
      const authUid = sessionUser?.id ? String(sessionUser.id) : null;

      if (sessionErr || !authUid || isDemoAuthorId(authUid)) {
        const structuredError: SupabaseStructuredError = {
          code: sanitizeErrorText(sessionErr?.code || 'AUTH_SESSION_MISSING') || 'AUTH_SESSION_MISSING',
          message:
            sanitizeErrorText(
              sessionErr?.message ||
                'No existe una sesión autenticada activa en Supabase Auth (auth.uid() es nulo).'
            ) || 'No existe una sesión autenticada activa en Supabase Auth.',
          details: 'Inicia sesión con tu cuenta real de Supabase Auth antes de publicar un anuncio.',
          hint: null
        };
        return {
          success: false,
          syncedWithSupabase: false,
          service,
          error: formatStructuredSupabaseError(structuredError),
          supabaseError: structuredError
        };
      }

      // 2. Verify that author_id matches auth.uid()
      const targetAuthorId = expectedAuthorId || service.authorId;
      if (targetAuthorId && targetAuthorId !== authUid) {
        const structuredError: SupabaseStructuredError = {
          code: 'AUTH_UID_MISMATCH',
          message: 'El author_id del anuncio no coincide con el auth.uid() de la sesión autenticada.',
          details: `author_id (${sanitizeErrorText(targetAuthorId)}) != auth.uid() (${sanitizeErrorText(authUid)})`,
          hint: 'Cierra sesión y vuelve a iniciar sesión con tu cuenta propietaria.'
        };
        return {
          success: false,
          syncedWithSupabase: false,
          service,
          error: formatStructuredSupabaseError(structuredError),
          supabaseError: structuredError
        };
      }

      const numericPrice =
        service.priceType === 'a_convenir'
          ? 0
          : Number.isFinite(Number(service.price)) && Number(service.price) >= 0
            ? Number(service.price)
            : 0;
      const validPriceType: ServiceListing['priceType'] =
        service.priceType === 'hora' ||
        service.priceType === 'trabajo' ||
        service.priceType === 'a_convenir'
          ? service.priceType
          : numericPrice === 0
            ? 'a_convenir'
            : 'hora';
      const validContactMethod: ServiceListing['contactMethod'] =
        service.contactMethod === 'whatsapp' ||
        service.contactMethod === 'phone' ||
        service.contactMethod === 'chat' ||
        service.contactMethod === 'email'
          ? service.contactMethod
          : 'whatsapp';

      const serviceToCreate: ServiceListing = {
        ...service,
        title: service.title.trim(),
        categoryId: service.categoryId || 'hogar',
        description: service.description.trim(),
        price: numericPrice,
        priceType: validPriceType,
        neighborhood: (service.neighborhood || 'Centro').trim() || 'Centro',
        city: (service.city || 'Madrid').trim() || 'Madrid',
        availability:
          (service.availability || 'Lunes a Viernes (tardes) y fines de semana').trim() ||
          'Lunes a Viernes (tardes) y fines de semana',
        imageUrl:
          service.imageUrl || '/src/assets/images/service_home_repairs_1791572265993.jpg',
        contactMethod: validContactMethod,
        contactValue: (service.contactValue || '').trim(),
        additionalNotes: service.additionalNotes ? service.additionalNotes.trim() : undefined,
        authorId: authUid,
        authorName: (service.authorName || 'Vecino').trim() || 'Vecino',
        authorAvatar: (service.authorAvatar || '').trim(),
        authorRating:
          typeof service.authorReviewCount === 'number' &&
          service.authorReviewCount > 0 &&
          typeof service.authorRating === 'number' &&
          Number.isFinite(service.authorRating) &&
          service.authorRating > 0
            ? service.authorRating
            : 0,
        authorReviewCount:
          typeof service.authorReviewCount === 'number' &&
          Number.isFinite(service.authorReviewCount) &&
          service.authorReviewCount > 0
            ? service.authorReviewCount
            : 0,
        createdAt: service.createdAt || new Date().toISOString(),
        status: editorialStatus,
        ownerSessionActive: true,
        isFeatured: false,
        featuredPlanId: undefined,
        featuredPlanName: undefined,
        featuredUntil: undefined,
        reportCount: 0
      };

      markAuthorConnected(authUid);

      // 3. Build strict 17-column client INSERT whitelist payload (TS-03)
      // Do NOT persist unconfirmed services into localStorage or userBackup before Supabase confirms the INSERT.
      const insertPayload = buildClientInsertRow(serviceToCreate, authUid);

      const { data: insertedRows, error } = await supabase
        .from('services')
        .insert([insertPayload])
        .select('*');

      if (error) {
        removeServiceFromUserBackup(authUid, serviceToCreate.id);
        const structuredError = extractSupabaseStructuredError(error);
        console.error('Supabase INSERT error on public.services:', {
          code: structuredError.code,
          message: structuredError.message,
          details: structuredError.details,
          hint: structuredError.hint
        });
        return {
          success: false,
          syncedWithSupabase: false,
          service: serviceToCreate,
          error: formatStructuredSupabaseError(structuredError),
          supabaseError: structuredError
        };
      }

      if (!Array.isArray(insertedRows) || insertedRows.length !== 1 || !insertedRows[0]) {
        removeServiceFromUserBackup(authUid, serviceToCreate.id);
        const noRowError: SupabaseStructuredError = {
          code: 'SUPABASE_INSERT_NO_ROW_RETURNED',
          message:
            'Supabase no devolvió la fila insertada. Verifica las políticas RLS (SELECT/INSERT) de public.services.',
          details: `Filas devueltas: ${Array.isArray(insertedRows) ? insertedRows.length : 0}`,
          hint: 'Comprueba la política SELECT para anuncios propios y borradores.'
        };
        return {
          success: false,
          syncedWithSupabase: false,
          service: serviceToCreate,
          error: formatStructuredSupabaseError(noRowError),
          supabaseError: noRowError
        };
      }

      // 4. Remote INSERT confirmed: use the authoritative database row from Supabase (TS-04)
      const [confirmedService] = checkExpiration([
        mapRowToService(insertedRows[0] as ServiceRow)
      ]);
      clearServicePendingRemoteSync(authUid, confirmedService.id);

      const existingBackup = getUserBackupServices(authUid);
      saveUserBackupServices(authUid, [
        confirmedService,
        ...existingBackup.filter(s => s.id !== confirmedService.id)
      ]);

      if (confirmedService.status === 'active') {
        const localList = getPublicVisibleServices(readRawCachedServices(), authUid);
        const updatedLocal = [confirmedService, ...localList.filter(s => s.id !== confirmedService.id)];
        saveServices(updatedLocal);
      }

      return {
        success: true,
        syncedWithSupabase: true,
        service: confirmedService
      };
    } catch (err: any) {
      const structuredError = extractSupabaseStructuredError(err, 'NETWORK_OR_UNEXPECTED_ERROR');
      console.error('Unexpected error inserting service into Supabase:', {
        code: structuredError.code,
        message: structuredError.message,
        details: structuredError.details
      });
      return {
        success: false,
        syncedWithSupabase: false,
        service,
        error: formatStructuredSupabaseError(structuredError),
        supabaseError: structuredError
      };
    }
  }

  // Pure local mode fallback when Supabase is not configured
  const localServiceToCreate: ServiceListing = {
    ...service,
    status: editorialStatus,
    ownerSessionActive: true
  };

  markAuthorConnected(localServiceToCreate.authorId);

  if (localServiceToCreate.status === 'active') {
    const localList = getPublicVisibleServices(readRawCachedServices(), localServiceToCreate.authorId);
    const updatedLocal = [
      localServiceToCreate,
      ...localList.filter(s => s.id !== localServiceToCreate.id)
    ];
    saveServices(updatedLocal);
  }

  const existingBackup = getUserBackupServices(localServiceToCreate.authorId);
  saveUserBackupServices(localServiceToCreate.authorId, [
    localServiceToCreate,
    ...existingBackup.filter(s => s.id !== localServiceToCreate.id)
  ]);

  return {
    success: true,
    syncedWithSupabase: false,
    service: localServiceToCreate
  };
}

/**
 * Update an existing service in Supabase and local cache.
 * Preserves the service's chosen editorial `status` ('active' | 'draft')
 * using the 15-column client UPDATE whitelist.
 */
export async function updateServiceRemote(
  service: ServiceListing,
  expectedAuthorId?: string
): Promise<{ success: boolean; service?: ServiceListing; error?: string }> {
  const updatedService: ServiceListing = {
    ...service,
    ownerSessionActive: service.ownerSessionActive ?? true
  };

  const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
  if (client) {
    try {
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      const authUserId = sessionData?.session?.user?.id;

      if (sessionErr || !authUserId) {
        return {
          success: false,
          error: 'Debes tener una sesión activa en Supabase Auth para editar un anuncio.'
        };
      }

      if (
        (expectedAuthorId && expectedAuthorId !== authUserId) ||
        (updatedService.authorId && updatedService.authorId !== authUserId)
      ) {
        return {
          success: false,
          error: 'Solo el propietario autenticado puede editar su propio anuncio.'
        };
      }

      // Verify ownership and moderation state against the remote database record
      const { data: remoteRow, error: checkError } = await client
        .from('services')
        .select('id, author_id, status')
        .eq('id', updatedService.id)
        .maybeSingle();

      if (checkError) {
        return {
          success: false,
          error: `No se pudo verificar la autoría del anuncio en Supabase (${checkError.code || 'Error'}): ${checkError.message}`
        };
      }

      if (!remoteRow) {
        return {
          success: false,
          error: 'El anuncio que intentas editar no existe en Supabase o no tienes permiso para acceder a él.'
        };
      }

      if (remoteRow.author_id !== authUserId) {
        return {
          success: false,
          error: 'Acceso denegado: solo el propietario autenticado puede editar su propio anuncio.'
        };
      }

      if (remoteRow.status === 'suspended') {
        return {
          success: false,
          error: 'No puedes editar ni reactivar un anuncio que ha sido suspendido por moderación.'
        };
      }

      // Build strict 15-column client UPDATE whitelist payload (TS-03)
      const updatePayload = buildClientUpdateRow({
        ...updatedService,
        authorId: authUserId
      });

      const { data: updatedRows, error } = await client
        .from('services')
        .update(updatePayload)
        .eq('id', updatedService.id)
        .eq('author_id', authUserId)
        .select('*');

      if (error) {
        const structured = extractSupabaseStructuredError(error, 'SUPABASE_UPDATE_ERROR');
        console.error('Error updating service in Supabase:', {
          code: structured.code,
          message: structured.message,
          details: structured.details
        });
        return {
          success: false,
          error: `No se pudo actualizar el anuncio en Supabase: ${formatStructuredSupabaseError(structured)}`
        };
      }

      if (!Array.isArray(updatedRows) || updatedRows.length !== 1 || !updatedRows[0]) {
        return {
          success: false,
          error:
            'Supabase no actualizó ninguna fila (0 filas afectadas). Verifica que exista la política RLS de UPDATE para tus propios anuncios.'
        };
      }

      const [confirmedService] = checkExpiration([
        mapRowToService(updatedRows[0] as ServiceRow)
      ]);
      clearServicePendingRemoteSync(authUserId, confirmedService.id);

      const localList = readRawCachedServices().filter(s => s.id !== confirmedService.id);
      if (confirmedService.status === 'active') {
        localList.unshift(confirmedService);
      }
      saveServices(getPublicVisibleServices(localList, confirmedService.authorId));

      const existingBackup = getUserBackupServices(confirmedService.authorId);
      saveUserBackupServices(confirmedService.authorId, [
        confirmedService,
        ...existingBackup.filter(s => s.id !== confirmedService.id)
      ]);

      return { success: true, service: confirmedService };
    } catch (err: any) {
      const structured = extractSupabaseStructuredError(err, 'NETWORK_UPDATE_ERROR');
      console.error('Network error updating service in Supabase:', {
        code: structured.code,
        message: structured.message
      });
      return {
        success: false,
        error: structured.message || 'Error de red al actualizar el anuncio.'
      };
    }
  }

  const localList = readRawCachedServices().filter(s => s.id !== updatedService.id);
  if (updatedService.status === 'active') {
    localList.unshift(updatedService);
  }
  saveServices(getPublicVisibleServices(localList, updatedService.authorId));

  // Keep owner's backup updated (both 'active' and 'draft')
  const existingBackup = getUserBackupServices(updatedService.authorId);
  saveUserBackupServices(updatedService.authorId, [
    updatedService,
    ...existingBackup.filter(s => s.id !== updatedService.id)
  ]);

  return { success: true, service: updatedService };
}

/**
 * Delete a service from Supabase and local cache.
 * Verifies authenticated user ownership and confirms actual deletion in Supabase before removing locally.
 */
export async function deleteServiceRemote(
  serviceId: string,
  expectedAuthorId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!serviceId) {
    return { success: false, error: 'Falta el identificador del anuncio a eliminar.' };
  }

  let verifiedOwnerId = expectedAuthorId || '';

  const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
  if (client) {
    try {
      // 1. Verify active Supabase Auth session
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      const authUserId = sessionData?.session?.user?.id;

      if (sessionErr || !authUserId) {
        return {
          success: false,
          error: 'Debes tener una sesión activa en Supabase Auth para poder eliminar un anuncio.'
        };
      }

      verifiedOwnerId = authUserId;

      if (expectedAuthorId && expectedAuthorId !== authUserId) {
        return {
          success: false,
          error: 'Solo el propietario autenticado puede eliminar su propio anuncio.'
        };
      }

      // 2. Check if the service exists in Supabase 'services' table
      const { data: remoteRow, error: checkError } = await client
        .from('services')
        .select('id, author_id')
        .eq('id', serviceId)
        .maybeSingle();

      if (checkError) {
        return {
          success: false,
          error: `No se pudo verificar el anuncio en Supabase (${checkError.code || 'Error'}): ${checkError.message}`
        };
      }

      if (!remoteRow) {
        return {
          success: false,
          error: 'El anuncio que intentas eliminar no existe en Supabase o no tienes permiso para acceder a él.'
        };
      }

      // Enforce strict ownership against database record
      if (remoteRow.author_id !== authUserId) {
        return {
          success: false,
          error: 'Acceso denegado: solo el propietario autenticado puede eliminar su propio anuncio.'
        };
      }

      // 3. Execute DELETE restricted by id and author_id
      const { data: deletedRows, error: deleteError } = await client
        .from('services')
        .delete()
        .eq('id', serviceId)
        .eq('author_id', authUserId)
        .select('id');

      if (deleteError) {
        console.error('Error deleting service from Supabase:', deleteError.message);
        return {
          success: false,
          error: `Error de Supabase al eliminar (${deleteError.code || 'RLS'}): ${deleteError.message}`
        };
      }

      // 4. Verify that exactly 1 row was deleted (PostgREST returns 0 rows without error when RLS or privileges block DELETE)
      if (!Array.isArray(deletedRows) || deletedRows.length !== 1) {
        return {
          success: false,
          error:
            'No se pudo eliminar el anuncio en Supabase (0 filas eliminadas): verifica los permisos GRANT DELETE y la política de seguridad (RLS) de la tabla "services".'
        };
      }
    } catch (err: any) {
      console.error('Network error deleting service from Supabase:', err);
      return {
        success: false,
        error: err?.message || 'Error de red al intentar eliminar el anuncio en Supabase.'
      };
    }
  }

  // Update local cache and remove from user backup only after remote deletion is confirmed
  const localList = readRawCachedServices();
  const updatedLocal = localList.filter(s => s.id !== serviceId);
  saveServices(updatedLocal);

  if (verifiedOwnerId) {
    removeServiceFromUserBackup(verifiedOwnerId, serviceId);
  }
  if (expectedAuthorId && expectedAuthorId !== verifiedOwnerId) {
    removeServiceFromUserBackup(expectedAuthorId, serviceId);
  }

  return { success: true };
}

/**
 * Query the backend server to verify whether the currently authenticated session
 * holds trusted administrator permissions (app_metadata.role === 'admin', public.profiles, or ADMIN_EMAILS).
 * Never logs or exposes the access token.
 */
export async function fetchAdminStatusRemote(accessToken?: string): Promise<boolean> {
  try {
    let token = accessToken;
    if (!token) {
      const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
      if (client) {
        const { data: sessionData } = await client.auth.getSession();
        token = sessionData?.session?.access_token;
      }
    }

    if (!token) {
      return false;
    }

    const res = await fetch('/api/auth/admin-status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    return Boolean(data?.isAdmin === true);
  } catch {
    return false;
  }
}

/**
 * Administrative Moderation: Suspend or reactivate a service via the protected server route
 * PATCH /api/admin/services/:serviceId/status.
 * Sends the current session's access_token via Authorization: Bearer without logging it,
 * and updates local cache only after confirmed server success.
 */
export async function adminUpdateServiceStatusRemote(
  serviceId: string,
  status: 'active' | 'suspended'
): Promise<{ success: boolean; status?: 'active' | 'suspended'; error?: string }> {
  const trimmedId = (serviceId || '').trim();
  if (!trimmedId) {
    return { success: false, error: 'Falta el identificador del anuncio a moderar.' };
  }

  if (status !== 'active' && status !== 'suspended') {
    return {
      success: false,
      error: "Estado de moderación inválido: solo se permite 'active' o 'suspended'."
    };
  }

  const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: 'Supabase Auth debe estar configurado para ejecutar acciones administrativas.'
    };
  }

  try {
    const { data: sessionData, error: sessionErr } = await client.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (sessionErr || !accessToken) {
      return {
        success: false,
        error: 'Debes tener una sesión activa en Supabase Auth para moderar anuncios.'
      };
    }

    const response = await fetch(`/api/admin/services/${encodeURIComponent(trimmedId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ status })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        error:
          payload?.error ||
          `No se pudo actualizar el estado del anuncio (HTTP ${response.status}).`
      };
    }

    const confirmedStatus: 'active' | 'suspended' =
      payload.status === 'suspended' ? 'suspended' : 'active';
    const targetAuthorId: string | undefined = payload.authorId;

    // Update local cache only after confirmed server success
    const rawList = readRawCachedServices();
    const existingItem = rawList.find(s => s.id === trimmedId);
    if (existingItem) {
      const updatedItem: ServiceListing = { ...existingItem, status: confirmedStatus };
      const filtered = rawList.filter(s => s.id !== trimmedId);
      if (confirmedStatus === 'active') {
        filtered.unshift(updatedItem);
      }
      saveServices(filtered);
    }

    if (targetAuthorId) {
      const ownerBackup = getUserBackupServices(targetAuthorId);
      const ownerItem = ownerBackup.find(s => s.id === trimmedId);
      if (ownerItem) {
        saveUserBackupServices(targetAuthorId, [
          { ...ownerItem, status: confirmedStatus },
          ...ownerBackup.filter(s => s.id !== trimmedId)
        ]);
      }
    }

    return { success: true, status: confirmedStatus };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error de red al comunicar con el servidor de moderación.'
    };
  }
}

/**
 * Administrative Moderation: Permanently delete a third-party service via the protected server route
 * DELETE /api/admin/services/:serviceId.
 * Sends the current session's access_token via Authorization: Bearer without logging it,
 * and updates local cache only after confirmed server deletion.
 */
export async function adminDeleteServiceRemote(
  serviceId: string,
  expectedAuthorId?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedId = (serviceId || '').trim();
  if (!trimmedId) {
    return { success: false, error: 'Falta el identificador del anuncio a eliminar.' };
  }

  const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: 'Supabase Auth debe estar configurado para ejecutar acciones administrativas.'
    };
  }

  try {
    const { data: sessionData, error: sessionErr } = await client.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (sessionErr || !accessToken) {
      return {
        success: false,
        error: 'Debes tener una sesión activa en Supabase Auth para eliminar anuncios.'
      };
    }

    const response = await fetch(`/api/admin/services/${encodeURIComponent(trimmedId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        error:
          payload?.error ||
          `No se pudo eliminar el anuncio en el servidor (HTTP ${response.status}).`
      };
    }

    // Update local cache only after confirmed server deletion
    const localList = readRawCachedServices();
    saveServices(localList.filter(s => s.id !== trimmedId));

    const ownerToClean = payload.authorId || expectedAuthorId;
    if (ownerToClean) {
      removeServiceFromUserBackup(ownerToClean, trimmedId);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error de red al intentar eliminar el anuncio desde el servidor.'
    };
  }
}

/**
 * Subscribe to real-time changes on the Supabase 'services' table.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToServicesRealtime(
  onDataChange: () => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('realtime:services')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'services' },
      () => {
        onDataChange();
      }
    )
    .subscribe();

  const client = supabase;
  return () => {
    client.removeChannel(channel);
  };
}

export function getCategories(): Category[] {
  return CATEGORIES;
}

export function getBoostPlans(): BoostPlan[] {
  return BOOST_PLANS;
}

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(id => typeof id === 'string' && !isDemoServiceId(id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function toggleFavorite(serviceId: string): string[] {
  if (!serviceId || isDemoServiceId(serviceId)) return getFavorites();
  const current = getFavorites();
  const exists = current.includes(serviceId);
  const updated = exists ? current.filter(id => id !== serviceId) : [...current, serviceId];
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function getTransactions(): PaymentTransaction[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PaymentTransaction[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(tx => !isDemoTransactionRecord(tx));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function recordTransaction(tx: PaymentTransaction): void {
  if (isDemoTransactionRecord(tx)) return;
  try {
    const current = getTransactions();
    const updated = [tx, ...current.filter(item => item.id !== tx.id)];
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function getReports(): ReportItem[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReportItem[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(
      r => r && !isDemoServiceId(String(r.serviceId || '')) && !isDemoAuthorId(String(r.reporterId || ''))
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(REPORTS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

/**
 * Stores a report strictly in local browser storage (`localStorage`) during Phase 1.
 * Never attempts to mutate or overwrite another user's service in Supabase (`updateServiceRemote`),
 * and does not falsify remote synchronization status.
 */
export function addReport(report: ReportItem): { savedLocally: boolean; syncedWithServer: false } {
  try {
    const current = getReports();
    const updated = [report, ...current];
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
    return { savedLocally: true, syncedWithServer: false };
  } catch {
    return { savedLocally: false, syncedWithServer: false };
  }
}

export function updateReportStatus(reportId: string, status: 'reviewed' | 'dismissed'): void {
  try {
    const current = getReports();
    const updated = current.map(r => r.id === reportId ? { ...r, status } : r);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function getChatMessages(serviceId: string): ChatMessage[] {
  if (!serviceId || isDemoServiceId(serviceId)) return [];
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(all)) return [];
    const cleaned = all.filter(
      msg => msg && !isDemoServiceId(String(msg.serviceId || '')) && !isDemoAuthorId(String(msg.senderId || ''))
    );
    if (cleaned.length !== all.length) {
      localStorage.setItem(CHAT_KEY, JSON.stringify(cleaned));
    }
    return cleaned.filter(msg => msg.serviceId === serviceId);
  } catch {
    return [];
  }
}

export function sendChatMessage(msg: ChatMessage): void {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    const all = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    all.push(msg);
    localStorage.setItem(CHAT_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
