import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ordersJournal, PayPalOrderJournalEntry } from './server_orders';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Persistent tracking of disconnected author IDs (owners who explicitly closed their session)
const PRESENCE_FILE_PATH = path.resolve(process.cwd(), 'data', 'session_presence.json');

function readDisconnectedAuthors(): Set<string> {
  try {
    if (fs.existsSync(PRESENCE_FILE_PATH)) {
      const raw = fs.readFileSync(PRESENCE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.disconnectedAuthorIds)) {
        return new Set<string>(parsed.disconnectedAuthorIds);
      }
    }
  } catch (err) {
    console.warn('Could not read session_presence.json:', err);
  }
  return new Set<string>();
}

function writeDisconnectedAuthors(set: Set<string>): void {
  try {
    const dir = path.dirname(PRESENCE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      PRESENCE_FILE_PATH,
      JSON.stringify({ disconnectedAuthorIds: Array.from(set), updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('Could not write session_presence.json:', err);
  }
}

const disconnectedAuthorIds = readDisconnectedAuthors();

// 0. Helper: Inspect SUPABASE_SERVICE_ROLE_KEY configuration state without exposing secrets.
// Validates that the key is either a valid Supabase secret API key (`sb_secret_...`) or a 3-part JWT with `role === 'service_role'`.
function getServiceRoleKeyStatus(): 'missing' | 'misconfigured' | 'configured' {
  const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!rawKey) {
    return 'missing';
  }
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (
    (anonKey && rawKey === anonKey) ||
    rawKey.startsWith('sb_publishable_') ||
    rawKey.includes('YOUR_SUPABASE') ||
    /\s/.test(rawKey)
  ) {
    return 'misconfigured';
  }

  // Case 1: New Supabase secret key format (`sb_secret_...`)
  if (rawKey.startsWith('sb_secret_')) {
    return rawKey.length > 20 ? 'configured' : 'misconfigured';
  }

  // Case 2: Classic JWT format (`header.payload.signature`) -> must carry `role: 'service_role'`
  const jwtParts = rawKey.split('.');
  if (jwtParts.length === 3) {
    try {
      const payloadJson = Buffer.from(jwtParts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      if (payload && payload.role === 'service_role') {
        return 'configured';
      }
      return 'misconfigured';
    } catch {
      return 'misconfigured';
    }
  }

  return 'misconfigured';
}

function isSafePublicSupabaseAnonKey(rawKey: string): boolean {
  const trimmed = (rawKey || '').trim();
  if (!trimmed || trimmed.includes('YOUR_SUPABASE') || trimmed.startsWith('sb_secret_') || /\s/.test(trimmed)) {
    return false;
  }
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (serviceRoleKey && trimmed === serviceRoleKey) {
    return false;
  }
  const jwtParts = trimmed.split('.');
  if (jwtParts.length === 3) {
    try {
      const payloadJson = Buffer.from(jwtParts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      if (payload && payload.role === 'service_role') {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

function getPublicSupabaseConfig(): {
  configured: boolean;
  url: string;
  anonKey: string;
  missingVars: string[];
} {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const rawAnon = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const validUrl = Boolean(url && url.startsWith('https://') && !url.includes('YOUR_SUPABASE'));
  const validAnon = isSafePublicSupabaseAnonKey(rawAnon);
  const missingVars: string[] = [];
  if (!validUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!validAnon) missingVars.push('VITE_SUPABASE_ANON_KEY');

  return {
    configured: validUrl && validAnon,
    url: validUrl ? url : '',
    anonKey: validAnon ? rawAnon : '',
    missingVars
  };
}

// Server-side Supabase clients:
// 1. `serverAuthSupabase`: used strictly for verifying user Bearer JWTs via `auth.getUser(token)`
// 2. `serverAdminSupabase`: privileged client initialized ONLY when `SUPABASE_SERVICE_ROLE_KEY` is validly configured (never falls back to anon key)
const serverSupabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const serverAnonKey = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();
const serverServiceRoleKey =
  getServiceRoleKeyStatus() === 'configured'
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    : '';

export const serverAuthSupabase: SupabaseClient | null =
  serverSupabaseUrl && (serverAnonKey || serverServiceRoleKey)
    ? createClient(serverSupabaseUrl, serverAnonKey || serverServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

export const serverAdminSupabase: SupabaseClient | null =
  serverSupabaseUrl && serverServiceRoleKey
    ? createClient(serverSupabaseUrl, serverServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

// Exported alias pointing strictly to the privileged client (never falls back silently to anon key)
export const serverSupabase: SupabaseClient | null = serverAdminSupabase;

/**
 * Middleware: Verify Supabase Auth JWT token
 * Validates the Bearer token against Supabase Auth without trusting client-side headers.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Autenticación requerida: falta cabecera Bearer token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Token de autenticación no proporcionado.' });
    return;
  }

  if (!serverAuthSupabase) {
    res.status(503).json({ error: 'Servicio de autenticación no configurado en el servidor.' });
    return;
  }

  try {
    const { data: { user }, error } = await serverAuthSupabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Token de sesión expirado o inválido.' });
      return;
    }

    // Attach authenticated user identity to request object
    (req as any).user = user;
    next();
  } catch (err: any) {
    console.error('Error verifying Supabase JWT in requireAuth:', err);
    res.status(500).json({ error: 'Error interno verificando la sesión del usuario.' });
  }
}

/**
 * Helper: Evaluate whether a server-verified Supabase Auth user holds trusted Admin permissions.
 * Uses strictly server-verified sources:
 *   1. user.app_metadata.role === 'admin' (managed solely by Supabase Auth server/service_role)
 *   2. public.profiles.role === 'admin' via serverAdminSupabase when privileged key is configured
 *   3. Server-side ADMIN_EMAILS whitelist environment variable
 * NEVER trusts user_metadata, client headers, request body, or demo personas.
 */
async function checkIsServerVerifiedAdmin(user: any): Promise<boolean> {
  if (!user || !user.id) {
    return false;
  }

  // 1. Source 1: Check verified claims in app_metadata (never user_metadata)
  if (user.app_metadata?.role === 'admin') {
    return true;
  }

  // 2. Source 2: If profiles table exists and serverAdminSupabase is configured, verify against public.profiles
  if (serverAdminSupabase) {
    try {
      const { data: profile, error } = await serverAdminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && profile && profile.role === 'admin') {
        return true;
      }
    } catch {
      // Ignore if profiles table not yet deployed
    }
  }

  // 3. Source 3: Trusted admin email whitelist in server environment (if configured)
  if (process.env.ADMIN_EMAILS && user.email) {
    const adminEmails = process.env.ADMIN_EMAILS
      .split(',')
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.includes(user.email.trim().toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Helper: Validate service identifier format to prevent malformed requests or path/query manipulation
 */
function isValidServiceId(rawId: unknown): rawId is string {
  if (typeof rawId !== 'string') return false;
  const trimmed = rawId.trim();
  if (trimmed.length < 1 || trimmed.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Middleware: Verify that authenticated user has trusted Admin role on the server side
 * Verifies app_metadata.role from verified JWT (managed solely by Supabase Auth server/service_role),
 * or public.profiles table via service_role client, or server-side ADMIN_EMAILS configuration.
 * NEVER trusts user_metadata (which can be edited by client), client headers, or demo state.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.id) {
    res.status(401).json({ error: 'Autenticación requerida para acceder al área de administración.' });
    return;
  }

  const isAdmin = await checkIsServerVerifiedAdmin(user);

  if (!isAdmin) {
    res.status(403).json({
      error: 'Acceso denegado: se requieren permisos administrativos verificados en el servidor.'
    });
    return;
  }

  next();
}

// 0. Health & Diagnostics endpoint (without exposing any secret values)
app.get('/api/health', (_req: Request, res: Response) => {
  const hasSupabaseUrl = Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const hasSupabaseAnonKey = Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
  const serviceRoleKeyStatus = getServiceRoleKeyStatus();
  const hasServiceRoleKey = serviceRoleKeyStatus === 'configured';
  const hasPaypalClientId = Boolean(process.env.PAYPAL_CLIENT_ID);
  const hasPaypalClientSecret = Boolean(process.env.PAYPAL_CLIENT_SECRET);
  const envType = (process.env.PAYPAL_ENVIRONMENT || '').trim().toLowerCase();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    configuration: {
      supabaseUrlConfigured: hasSupabaseUrl,
      supabaseAnonKeyConfigured: hasSupabaseAnonKey,
      supabaseServiceRoleKeyConfigured: hasServiceRoleKey,
      supabaseServiceRoleKeyStatus: serviceRoleKeyStatus,
      paypalClientIdConfigured: hasPaypalClientId,
      paypalClientSecretConfigured: hasPaypalClientSecret,
      paypalEnvironment: envType === 'live' ? 'live' : 'sandbox'
    }
  });
});

// 0.1 Public Supabase runtime configuration for client SPA when Vite build-time env vars are absent.
// Strictly exposes ONLY the public URL and public anon/publishable key (never service_role or secret keys).
app.get('/api/supabase/config', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getPublicSupabaseConfig());
});

app.get('/api/supabase/public-env.js', (_req: Request, res: Response) => {
  const pub = getPublicSupabaseConfig();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__VECINOYA_SUPABASE_CONFIG__ = ${JSON.stringify(pub)};\n`);
});

// 0.25 Authenticated endpoint returning strictly a server-calculated boolean { isAdmin }
// Uses the exact same trusted rules as requireAdmin without mutating app_metadata or trusting client input.
app.get('/api/auth/admin-status', requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  if (!authUser || !authUser.id) {
    res.status(401).json({ error: 'Sesión no válida.' });
    return;
  }

  const isAdmin = await checkIsServerVerifiedAdmin(authUser);
  res.json({ isAdmin: Boolean(isAdmin) });
});

// 0.5 Session-linked service visibility endpoints
// Note: Session presence NEVER alters the editorial `status` ('active' | 'draft' | 'suspended') of any service.
app.get('/api/session/presence', (_req: Request, res: Response) => {
  res.json({
    disconnectedAuthorIds: Array.from(disconnectedAuthorIds)
  });
});

app.post('/api/session/presence', requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  if (!authUser || !authUser.id) {
    res.status(401).json({ error: 'Sesión no válida.' });
    return;
  }

  const isOnline = Boolean(req.body?.online);
  if (isOnline) {
    disconnectedAuthorIds.delete(authUser.id);
  } else {
    disconnectedAuthorIds.add(authUser.id);
  }
  writeDisconnectedAuthors(disconnectedAuthorIds);

  res.json({
    success: true,
    userId: authUser.id,
    online: isOnline,
    disconnectedAuthorIds: Array.from(disconnectedAuthorIds)
  });
});

// 0.75 Administrative Moderation Endpoints (Protected by requireAuth + requireAdmin)
app.patch('/api/admin/services/:serviceId/status', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  if (!authUser || !authUser.id) {
    res.status(401).json({ error: 'Autenticación requerida.' });
    return;
  }

  if (!serverSupabase || getServiceRoleKeyStatus() !== 'configured') {
    res.status(503).json({
      error: 'Moderación administrativa no disponible: el cliente privilegiado de Supabase no está configurado válidamente en el servidor.'
    });
    return;
  }

  const rawServiceId = req.params.serviceId;
  if (!isValidServiceId(rawServiceId)) {
    res.status(400).json({ error: 'Identificador de anuncio inválido.' });
    return;
  }
  const serviceId = rawServiceId.trim();

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Cuerpo de solicitud inválido.' });
    return;
  }

  const bodyKeys = Object.keys(req.body);
  if (bodyKeys.length !== 1 || bodyKeys[0] !== 'status') {
    res.status(400).json({
      error: 'Solicitud rechazada: esta ruta solo permite actualizar la columna status.'
    });
    return;
  }

  const nextStatus = req.body.status;
  if (nextStatus !== 'active' && nextStatus !== 'suspended') {
    res.status(400).json({
      error: "Valor de status inválido: solo se permite 'active' o 'suspended'."
    });
    return;
  }

  try {
    const { data: existingService, error: fetchError } = await serverSupabase
      .from('services')
      .select('id, author_id, status')
      .eq('id', serviceId)
      .maybeSingle();

    if (fetchError) {
      res.status(502).json({
        error: `Error al consultar el anuncio en Supabase (${fetchError.code || 'DB_ERROR'}): ${fetchError.message}`
      });
      return;
    }

    if (!existingService) {
      res.status(404).json({ error: 'El anuncio especificado no existe en Supabase.' });
      return;
    }

    if (existingService.status === 'draft' && nextStatus === 'active') {
      res.status(400).json({
        error: 'Operación no permitida: moderación no puede publicar como activo un borrador privado (draft).'
      });
      return;
    }

    const { data: updatedRows, error: updateError } = await serverSupabase
      .from('services')
      .update({ status: nextStatus })
      .eq('id', serviceId)
      .select('id, status, author_id');

    if (updateError) {
      res.status(502).json({
        error: `No se pudo actualizar el estado del anuncio en Supabase (${updateError.code || 'DB_ERROR'}): ${updateError.message}`
      });
      return;
    }

    if (!updatedRows || updatedRows.length !== 1 || updatedRows[0].status !== nextStatus) {
      res.status(500).json({
        error: 'No se pudo confirmar la actualización de estado del anuncio en Supabase.'
      });
      return;
    }

    res.json({
      success: true,
      serviceId: updatedRows[0].id,
      status: updatedRows[0].status,
      authorId: updatedRows[0].author_id
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Error interno del servidor al actualizar el estado del anuncio.'
    });
  }
});

app.delete('/api/admin/services/:serviceId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  if (!authUser || !authUser.id) {
    res.status(401).json({ error: 'Autenticación requerida.' });
    return;
  }

  if (!serverSupabase || getServiceRoleKeyStatus() !== 'configured') {
    res.status(503).json({
      error: 'Moderación administrativa no disponible: el cliente privilegiado de Supabase no está configurado válidamente en el servidor.'
    });
    return;
  }

  const rawServiceId = req.params.serviceId;
  if (!isValidServiceId(rawServiceId)) {
    res.status(400).json({ error: 'Identificador de anuncio inválido.' });
    return;
  }
  const serviceId = rawServiceId.trim();

  try {
    const { data: existingService, error: fetchError } = await serverSupabase
      .from('services')
      .select('id, author_id')
      .eq('id', serviceId)
      .maybeSingle();

    if (fetchError) {
      res.status(502).json({
        error: `Error al verificar el anuncio en Supabase (${fetchError.code || 'DB_ERROR'}): ${fetchError.message}`
      });
      return;
    }

    if (!existingService) {
      res.status(404).json({ error: 'El anuncio que intentas eliminar no existe en Supabase.' });
      return;
    }

    const { data: deletedRows, error: deleteError } = await serverSupabase
      .from('services')
      .delete()
      .eq('id', serviceId)
      .select('id');

    if (deleteError) {
      res.status(502).json({
        error: `Error al eliminar el anuncio en Supabase (${deleteError.code || 'DB_ERROR'}): ${deleteError.message}`
      });
      return;
    }

    if (!deletedRows || deletedRows.length !== 1) {
      const { data: stillExists } = await serverSupabase
        .from('services')
        .select('id')
        .eq('id', serviceId)
        .maybeSingle();

      if (stillExists) {
        res.status(500).json({
          error: 'No se pudo confirmar la eliminación del anuncio en Supabase.'
        });
        return;
      }
    }

    res.json({
      success: true,
      deletedId: serviceId,
      authorId: existingService.author_id
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Error interno del servidor al eliminar el anuncio.'
    });
  }
});

// Official non-negotiable prices and durations defined strictly on the server
const OFFICIAL_BOOST_PLANS: Record<string, { name: string; price: number; durationDays: number }> = {
  basico: {
    name: 'Plan Básico',
    price: 1.50,
    durationDays: 3
  },
  intermedio: {
    name: 'Plan Intermedio',
    price: 3.00,
    durationDays: 7
  },
  avanzado: {
    name: 'Plan Avanzado',
    price: 5.00,
    durationDays: 15
  },
  premium: {
    name: 'Plan Premium',
    price: 8.00,
    durationDays: 30
  }
};

// In-memory set to prevent duplicate order captures (replay protection)
const capturedOrderIds = new Set<string>();

const rawEnv = (process.env.PAYPAL_ENVIRONMENT || '').trim().toLowerCase();
const isLive = rawEnv === 'live' || rawEnv === 'production' || (rawEnv !== 'sandbox' && (process.env.PAYPAL_CLIENT_ID?.startsWith('BA') || rawEnv.length > 20));
const PAYPAL_API_BASE = isLive
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

/**
 * Helper to obtain PayPal OAuth2 access token securely using server-side credentials
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('MISSING_CREDENTIALS');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PayPal OAuth error:', response.status, errorText);
    throw new Error(`PayPal auth failed with status ${response.status}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Inspección del estado de la orden en PayPal (recuperación de cortes de red sin duplicar cobros)
 */
async function getPayPalOrderDetails(orderId: string, accessToken: string): Promise<any | null> {
  try {
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (err) {
    console.error('Error fetching PayPal order details:', err);
    return null;
  }
}

// 1. Check PayPal server configuration status
app.get('/api/paypal/config', (_req: Request, res: Response) => {
  const hasClientId = Boolean(process.env.PAYPAL_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.PAYPAL_CLIENT_SECRET);
  const isConfigured = hasClientId && hasClientSecret;

  res.json({
    configured: isConfigured,
    clientId: hasClientId ? process.env.PAYPAL_CLIENT_ID : null,
    environment: isLive ? 'live' : 'sandbox',
    currency: 'EUR',
    officialPlans: OFFICIAL_BOOST_PLANS
  });
});

// 2. Create PayPal Order endpoint (Protected by requireAuth)
app.post('/api/paypal/create-order', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.id) {
      res.status(401).json({ error: 'Usuario no autenticado en Supabase.' });
      return;
    }

    if (!serverAdminSupabase || getServiceRoleKeyStatus() !== 'configured') {
      res.status(503).json({
        error:
          'Las promociones de pago no están disponibles temporalmente: falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para verificar y activar anuncios.'
      });
      return;
    }

    const { planId, serviceId } = req.body || {};

    if (!planId || typeof planId !== 'string' || !OFFICIAL_BOOST_PLANS[planId]) {
      res.status(400).json({ error: 'Plan de destacado inválido o no reconocido.' });
      return;
    }

    if (!isValidServiceId(serviceId)) {
      res.status(400).json({ error: 'Identificador del servicio a destacar inválido o ausente.' });
      return;
    }
    const normalizedServiceId = serviceId.trim();

    // Prevent concurrent capture collisions on the same service
    const activeCapturingOrder = ordersJournal
      .getUserOrders(authUser.id)
      .find(o => o.serviceId === normalizedServiceId && o.status === 'CAPTURING');
    if (activeCapturingOrder) {
      res.status(409).json({
        error: 'Ya existe una captura de pago en curso para este anuncio. Espera unos segundos.'
      });
      return;
    }

    // Verify in Supabase that the service exists, belongs to authUser.id, and is 'active'
    const { data: srvRow, error: srvError } = await serverAdminSupabase
      .from('services')
      .select('id, author_id, status, title')
      .eq('id', normalizedServiceId)
      .maybeSingle();

    if (srvError) {
      res.status(502).json({
        error: `No se pudo verificar el anuncio en Supabase (${srvError.code || 'DB_ERROR'}): ${srvError.message}`
      });
      return;
    }

    if (!srvRow) {
      res.status(404).json({
        error: 'El anuncio que intentas promocionar no existe en Supabase (public.services).'
      });
      return;
    }

    if (srvRow.author_id !== authUser.id) {
      res.status(403).json({
        error: 'Acceso denegado: solo el propietario autenticado puede promocionar su propio anuncio.'
      });
      return;
    }

    if (srvRow.status !== 'active') {
      res.status(400).json({
        error:
          'Solo se pueden promocionar anuncios publicados y activos. No es posible destacar borradores ni anuncios suspendidos.'
      });
      return;
    }

    const plan = OFFICIAL_BOOST_PLANS[planId];
    const amountStr = plan.price.toFixed(2); // estrictamente determinado por el servidor

    const accessToken = await getPayPalAccessToken();

    // Payload de PayPal con custom_id para auditoría en el panel de PayPal
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `${normalizedServiceId}#${planId}`,
          custom_id: JSON.stringify({ userId: authUser.id, serviceId: normalizedServiceId, planId }),
          description: `VecinoYa - ${plan.name} (${plan.durationDays} días)`,
          amount: {
            currency_code: 'EUR',
            value: amountStr
          }
        }
      ],
      application_context: {
        brand_name: 'VecinoYa',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW'
      }
    };

    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json() as { id?: string; status?: string; message?: string };

    if (!orderResponse.ok || !orderData.id) {
      console.error('PayPal create order failure:', orderData);
      res.status(orderResponse.status || 500).json({
        error: orderData.message || 'Error al crear la orden en PayPal Sandbox.'
      });
      return;
    }

    // Vincular y persistir la orden en el servidor con usuario, servicio y plan verificados
    ordersJournal.createOrder({
      orderId: orderData.id,
      userId: authUser.id,
      userEmail: authUser.email,
      userName: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Vecino',
      serviceId: normalizedServiceId,
      serviceTitle: srvRow.title || 'Servicio VecinoYa',
      planId,
      planName: plan.name,
      amount: plan.price,
      currency: 'EUR',
      durationDays: plan.durationDays
    });

    res.json({
      orderId: orderData.id,
      status: orderData.status,
      planName: plan.name,
      amount: amountStr,
      currency: 'EUR'
    });
  } catch (error: any) {
    if (error.message === 'MISSING_CREDENTIALS') {
      res.status(503).json({
        error: 'Las credenciales de PayPal Sandbox no están configuradas en el servidor.'
      });
      return;
    }
    console.error('Error in /api/paypal/create-order:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al procesar la orden.' });
  }
});

// 3. Capture PayPal Order endpoint (Protected by requireAuth and persistent idempotency)
app.post('/api/paypal/capture-order', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.id) {
      res.status(401).json({ error: 'Usuario no autenticado en Supabase.' });
      return;
    }

    const { orderId } = req.body || {};

    if (!orderId || typeof orderId !== 'string') {
      res.status(400).json({ error: 'Identificador de orden de PayPal no proporcionado.' });
      return;
    }

    // Recuperar la orden registrada previamente en el servidor
    const storedOrder = ordersJournal.getOrder(orderId);
    if (!storedOrder) {
      res.status(400).json({
        error: 'Orden no encontrada o no originada válidamente en este servidor.'
      });
      return;
    }

    // Validación de propiedad: comprobar que el usuario autenticado es quien creó la orden
    if (storedOrder.userId !== authUser.id) {
      res.status(403).json({
        error: 'Acceso no autorizado: la orden de pago pertenece a otra cuenta de usuario.'
      });
      return;
    }

    // Idempotencia persistente y protección contra doble cobro concurrente:
    // 1. Si ya está completada, retornar respuesta cacheada
    if (storedOrder.status === 'CAPTURED') {
      res.json({
        success: true,
        idempotentReplay: true,
        orderId: storedOrder.orderId,
        captureId: storedOrder.captureId,
        status: 'COMPLETED',
        serviceId: storedOrder.serviceId,
        serviceTitle: storedOrder.serviceTitle,
        planId: storedOrder.planId,
        planName: storedOrder.planName,
        durationDays: storedOrder.durationDays,
        amount: storedOrder.amount,
        currency: 'EUR',
        createdAt: storedOrder.createdAt,
        expiresAt: storedOrder.expiresAt,
        supabaseSyncStatus: storedOrder.supabaseSyncStatus
      });
      return;
    }

    // Exigir SUPABASE_SERVICE_ROLE_KEY ANTES de capturar fondos en PayPal para no cobrar sin poder activar
    if (!serverAdminSupabase || getServiceRoleKeyStatus() !== 'configured') {
      res.status(503).json({
        error:
          'No se puede procesar la captura: SUPABASE_SERVICE_ROLE_KEY no está configurado válidamente en el servidor.'
      });
      return;
    }

    // 2. Intentar adquirir bloqueo exclusivo de captura (evita condiciones de carrera simultáneas)
    const lockResult = ordersJournal.claimCaptureLock(orderId);
    if (!lockResult.success) {
      if (lockResult.reason === 'ALREADY_CAPTURED') {
        const captured = ordersJournal.getOrder(orderId);
        res.json({
          success: true,
          idempotentReplay: true,
          orderId: captured?.orderId,
          captureId: captured?.captureId,
          status: 'COMPLETED',
          serviceId: captured?.serviceId,
          serviceTitle: captured?.serviceTitle,
          planId: captured?.planId,
          planName: captured?.planName,
          durationDays: captured?.durationDays,
          amount: captured?.amount,
          currency: 'EUR',
          createdAt: captured?.createdAt,
          expiresAt: captured?.expiresAt,
          supabaseSyncStatus: captured?.supabaseSyncStatus
        });
        return;
      }
      res.status(409).json({
        error: 'Procesamiento concurrente detectado: la captura de esta orden ya está en progreso en el servidor.'
      });
      return;
    }

    const plan = OFFICIAL_BOOST_PLANS[storedOrder.planId];
    if (!plan) {
      ordersJournal.releaseCaptureLock(orderId, 'PLAN_INVALIDO');
      res.status(400).json({ error: 'Plan de destacado inválido en la orden registrada.' });
      return;
    }

    // 3. Verificar en Supabase ANTES de capturar el pago que el anuncio sigue existiendo, pertenece al usuario y está activo
    const { data: preCheckService, error: preCheckErr } = await serverAdminSupabase
      .from('services')
      .select('id, author_id, status')
      .eq('id', storedOrder.serviceId)
      .maybeSingle();

    if (preCheckErr) {
      ordersJournal.releaseCaptureLock(orderId, undefined);
      res.status(502).json({
        error: `No se pudo verificar el estado del anuncio en Supabase antes de capturar el pago: ${preCheckErr.message}`
      });
      return;
    }

    if (!preCheckService) {
      ordersJournal.releaseCaptureLock(orderId, 'SERVICE_NOT_FOUND');
      res.status(404).json({
        error: 'El anuncio asociado a esta orden ya no existe en Supabase. No se ha realizado ningún cargo.'
      });
      return;
    }

    if (preCheckService.author_id !== storedOrder.userId) {
      ordersJournal.releaseCaptureLock(orderId, 'OWNER_MISMATCH');
      res.status(403).json({
        error: 'La titularidad del anuncio no coincide con el usuario de la orden. No se ha realizado ningún cargo.'
      });
      return;
    }

    if (preCheckService.status !== 'active') {
      ordersJournal.releaseCaptureLock(orderId, 'SERVICE_NOT_ACTIVE');
      res.status(400).json({
        error: 'El anuncio no se encuentra activo (está en borrador o suspendido). No se ha realizado ningún cargo.'
      });
      return;
    }

    let accessToken: string;
    try {
      accessToken = await getPayPalAccessToken();
    } catch (tokenErr: any) {
      ordersJournal.releaseCaptureLock(orderId, undefined);
      throw tokenErr;
    }

    let captureResponse: globalThis.Response;
    try {
      captureResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (netErr: any) {
      ordersJournal.releaseCaptureLock(orderId, undefined);
      throw netErr;
    }

    let captureData = await captureResponse.json() as any;

    // Recuperación de estado: Si PayPal responde ORDER_ALREADY_CAPTURED (corte de red tras cobro),
    // consultar el estado directamente en PayPal sin intentar cobrar de nuevo.
    const isAlreadyCapturedInPayPal =
      captureData?.name === 'ORDER_ALREADY_CAPTURED' ||
      captureData?.details?.some((d: any) => d.issue === 'ORDER_ALREADY_CAPTURED');

    if (!captureResponse.ok && isAlreadyCapturedInPayPal) {
      console.warn(`[PayPal Recovery] Orden ${orderId} ya figuraba capturada en PayPal. Consultando estado...`);
      const existingOrderInfo = await getPayPalOrderDetails(orderId, accessToken);
      if (existingOrderInfo && existingOrderInfo.status === 'COMPLETED') {
        captureData = existingOrderInfo;
      }
    }

    if ((!captureResponse.ok && !isAlreadyCapturedInPayPal) || captureData.status !== 'COMPLETED') {
      console.error('PayPal capture failure:', captureData);
      ordersJournal.releaseCaptureLock(orderId, captureData.message || 'PAYPAL_CAPTURE_REJECTED');
      res.status(captureResponse.status || 400).json({
        error: captureData.message || `La captura no se completó (Estado: ${captureData.status || 'FALLIDO'}).`
      });
      return;
    }

    // Verificación estricta del estado de la captura, monto, moneda y metadatos de la unidad de compra en la respuesta real de PayPal
    const purchaseUnit = captureData.purchase_units?.[0];
    const captureDetail = purchaseUnit?.payments?.captures?.[0];

    if (!captureDetail || captureDetail.status !== 'COMPLETED') {
      ordersJournal.releaseCaptureLock(orderId, 'CAPTURE_DETAIL_NOT_COMPLETED');
      res.status(400).json({
        error: `El cobro en PayPal no figura como COMPLETED en el detalle de captura (Estado: ${captureDetail?.status || 'DESCONOCIDO'}).`
      });
      return;
    }

    const capturedAmount = parseFloat(captureDetail?.amount?.value || '0');
    const capturedCurrency = captureDetail?.amount?.currency_code;

    if (capturedCurrency !== 'EUR' || Math.abs(capturedAmount - storedOrder.amount) > 0.01) {
      console.error('Monto o moneda capturada no coincide:', {
        capturedAmount,
        capturedCurrency,
        expected: storedOrder.amount
      });
      ordersJournal.releaseCaptureLock(orderId, 'AMOUNT_MISMATCH');
      res.status(400).json({
        error: 'El importe o la divisa verificados en PayPal no coinciden con las especificaciones del plan del servidor.'
      });
      return;
    }

    const expectedReferenceId = `${storedOrder.serviceId}#${storedOrder.planId}`;
    if (purchaseUnit?.reference_id && purchaseUnit.reference_id !== expectedReferenceId) {
      ordersJournal.releaseCaptureLock(orderId, 'REFERENCE_ID_MISMATCH');
      res.status(400).json({
        error: 'La referencia del servicio/plan en la orden de PayPal no coincide con la orden registrada.'
      });
      return;
    }

    const rawCustomId = captureDetail?.custom_id || purchaseUnit?.custom_id;
    if (rawCustomId && typeof rawCustomId === 'string') {
      try {
        const parsedCustom = JSON.parse(rawCustomId);
        if (
          parsedCustom.userId !== storedOrder.userId ||
          parsedCustom.serviceId !== storedOrder.serviceId ||
          parsedCustom.planId !== storedOrder.planId
        ) {
          ordersJournal.releaseCaptureLock(orderId, 'CUSTOM_ID_MISMATCH');
          res.status(400).json({
            error: 'Los metadatos de auditoría (custom_id) de PayPal no coinciden con la orden del servidor.'
          });
          return;
        }
      } catch {
        ordersJournal.releaseCaptureLock(orderId, 'CUSTOM_ID_INVALID');
        res.status(400).json({
          error: 'Formato inválido en los metadatos custom_id devueltos por PayPal.'
        });
        return;
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + storedOrder.durationDays * 86400000).toISOString();
    const captureId = captureDetail?.id || orderId;
    const payerEmail = captureData.payer?.email_address || undefined;

    // Sincronización real con la tabla existente `public.services` usando `serverAdminSupabase`
    // Restringido a `id`, `author_id` y `status = 'active'` (nunca activa promociones sobre borradores ni suspendidos)
    let syncStatus: 'synced' | 'pending' | 'skipped_no_credentials' = 'pending';
    let syncError: string | undefined = undefined;

    try {
      const srvRes = await serverAdminSupabase
        .from('services')
        .update({
          is_featured: true,
          featured_plan_id: storedOrder.planId,
          featured_plan_name: storedOrder.planName,
          featured_until: expiresAt
        })
        .eq('id', storedOrder.serviceId)
        .eq('author_id', storedOrder.userId)
        .eq('status', 'active')
        .select('id, status, is_featured, featured_plan_id, featured_plan_name, featured_until');

      const serviceUpdated =
        !srvRes.error &&
        Array.isArray(srvRes.data) &&
        srvRes.data.length === 1 &&
        srvRes.data[0].is_featured === true &&
        srvRes.data[0].featured_plan_id === storedOrder.planId &&
        Boolean(srvRes.data[0].featured_until);

      if (serviceUpdated) {
        syncStatus = 'synced';
      } else {
        syncError =
          srvRes.error?.message ||
          'No se pudo confirmar la actualización de 1 fila activa en public.services tras la captura.';
        syncStatus = 'pending';
      }
    } catch (dbErr: any) {
      syncError = dbErr.message || 'Excepción comunicando con Supabase';
      syncStatus = 'pending';
    }

    // Persistir el estado de la captura en el diario del servidor
    const capturedOrder = ordersJournal.markCaptured(
      orderId,
      captureId,
      payerEmail,
      expiresAt,
      syncStatus,
      syncError
    );

    res.json({
      success: true,
      orderId,
      captureId,
      status: 'COMPLETED',
      serviceId: storedOrder.serviceId,
      serviceTitle: storedOrder.serviceTitle,
      planId: storedOrder.planId,
      planName: storedOrder.planName,
      durationDays: storedOrder.durationDays,
      amount: storedOrder.amount,
      currency: 'EUR',
      createdAt: now.toISOString(),
      expiresAt,
      payerEmail,
      supabaseSyncStatus: capturedOrder.supabaseSyncStatus
    });
  } catch (error: any) {
    if (error.message === 'MISSING_CREDENTIALS') {
      res.status(503).json({
        error: 'Credenciales de PayPal Sandbox no configuradas en el servidor.'
      });
      return;
    }
    console.error('Error in /api/paypal/capture-order:', error);
    res.status(500).json({ error: error.message || 'Error al capturar la orden de PayPal.' });
  }
});

// 4. Endpoint de historial financiero para el usuario autenticado
app.get('/api/paypal/my-transactions', requireAuth, (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const userOrders = ordersJournal.getUserOrders(authUser.id);
  res.json({ transactions: userOrders });
});

// 5. Endpoint de conciliación de pagos pendientes de sincronizar con Supabase (Exclusivo administradores)
app.post('/api/admin/reconcile-pending', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  if (!serverAdminSupabase || getServiceRoleKeyStatus() !== 'configured') {
    res.status(503).json({
      error: 'Conciliación no disponible: SUPABASE_SERVICE_ROLE_KEY no está configurado válidamente en el servidor.'
    });
    return;
  }

  const pending = ordersJournal.getPendingSyncOrders();
  const results: any[] = [];

  for (const order of pending) {
    try {
      const targetExpiresAt = order.expiresAt || new Date(Date.now() + order.durationDays * 86400000).toISOString();

      const { data: srvData, error: srvErr } = await serverAdminSupabase
        .from('services')
        .update({
          is_featured: true,
          featured_plan_id: order.planId,
          featured_plan_name: order.planName,
          featured_until: targetExpiresAt
        })
        .eq('id', order.serviceId)
        .eq('author_id', order.userId)
        .eq('status', 'active')
        .select('id, status, is_featured, featured_plan_id, featured_until');

      const serviceUpdated =
        !srvErr &&
        Array.isArray(srvData) &&
        srvData.length === 1 &&
        srvData[0].is_featured === true &&
        srvData[0].featured_plan_id === order.planId &&
        Boolean(srvData[0].featured_until);

      if (serviceUpdated) {
        ordersJournal.updateSyncStatus(order.orderId, 'synced');
        results.push({ orderId: order.orderId, status: 'synced', method: 'direct_services_update' });
      } else {
        results.push({
          orderId: order.orderId,
          status: 'failed',
          error: srvErr?.message || 'El anuncio no existe, no está activo o no pertenece al comprador.'
        });
      }
    } catch (err: any) {
      results.push({ orderId: order.orderId, status: 'exception', error: err.message });
    }
  }

  res.json({
    totalPending: pending.length,
    reconciledCount: results.filter(r => r.status === 'synced').length,
    results
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[VecinoYa Full-Stack Server] running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VecinoYa server:', err);
  process.exit(1);
});
