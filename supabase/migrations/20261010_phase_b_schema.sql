-- ==============================================================================
-- VECINOYA - MIGRACIÓN REVISADA FASE B:
-- ESTRUCTURA COMPROBADA, RESTRICCIONES REALES, ÓRDENES PERSISTENTES Y SEGURIDAD
-- ==============================================================================
-- REGLA OBLIGATORIA: ESTE SCRIPT ES PARA REVISIÓN TÉCNICA.
-- NO SE EJECUTA AUTOMÁTICAMENTE EN SUPABASE HASTA AUTORIZACIÓN EXPRESA.
-- ==============================================================================
-- RESULTADOS DE LA INSPECCIÓN PREVIA DEL ESQUEMA REAL:
-- 1. Tabla 'public.services' EXISTE con las siguientes columnas verificadas:
--    - id (TEXT, PRIMARY KEY)
--    - title (TEXT)
--    - description (TEXT)
--    - category_id (TEXT)
--    - price (NUMERIC)
--    - neighborhood (TEXT)
--    - city (TEXT)
--    - image_url (TEXT)
--    - author_id (TEXT, guarda el ID de usuario como cadena; RLS requiere cast ::text)
--    - author_name (TEXT)
--    - author_avatar (TEXT)
--    - is_featured (BOOLEAN)
--    - featured_plan_id (TEXT)
--    - featured_plan_name (TEXT)
--    - featured_until (TIMESTAMPTZ - comprobado con date/time parsing)
--    - status (TEXT)
--    - created_at (TIMESTAMPTZ)
--    - updated_at (TIMESTAMPTZ)
-- 2. Las columnas 'category', 'location', 'phone', 'images' NO existen en 'services'.
-- 3. La tabla 'public.profiles' NO existe aún.
-- 4. Las tablas 'public.payment_orders' y 'public.payment_transactions' NO existen aún.
-- ==============================================================================

-- 1. EXTENSIÓN UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. TABLA: public.profiles (Gestión Segura de Identidad y Roles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  neighborhood TEXT DEFAULT 'Barrio General',
  city TEXT DEFAULT 'Madrid',
  bio TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lectura: cada usuario autenticado solo puede leer su propio perfil completo con datos privados
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Actualización: cada usuario solo puede editar sus propios datos de contacto
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Bloqueo de inserción directa desde el cliente: los perfiles se crean vía trigger o backend
REVOKE INSERT ON public.profiles FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. VISTA PÚBLICA SEGURA: public.public_profiles (Protección de PII)
-- ------------------------------------------------------------------------------
-- Se utiliza 'security_invoker = true' para respetar el contexto de seguridad y
-- expone únicamente campos no sensibles (oculta email, phone y role).
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
  SELECT
    id,
    name,
    avatar,
    neighborhood,
    city,
    bio,
    created_at
  FROM public.profiles;

-- Otorgar permiso de lectura pública a la vista sanitizada
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. TRIGGERS DE SEGURIDAD PARA PROFILES
-- ------------------------------------------------------------------------------
-- A. Impedir alteración o auto-asignación del rol 'admin'
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el rol cambia, solo permitirlo si la petición proviene del service_role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF COALESCE((auth.jwt() ->> 'role'), '') != 'service_role' AND current_user != 'service_role' THEN
      NEW.role := OLD.role; -- Se revierte el intento de escalada
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- B. Auto-creación de perfil al registrarse un nuevo usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar, neighborhood, city, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'),
    COALESCE(NEW.raw_user_meta_data->>'neighborhood', 'Barrio General'),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Madrid'),
    'user' -- Siempre rol inicial 'user', jamás 'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- 5. TABLA PERSISTENTE DE ÓRDENES: public.payment_orders (Alternativa robusta al disco)
-- ------------------------------------------------------------------------------
-- Reemplaza el archivo efímero local en entornos Cloud Serverless.
-- Guarda la relación usuario <-> servicio <-> plan desde el momento de crear la orden.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  order_id TEXT PRIMARY KEY, -- PayPal Order ID
  user_id TEXT NOT NULL, -- auth.uid() del comprador
  service_id TEXT NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_title TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  duration_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'CAPTURING', 'CAPTURED', 'FAILED')),
  payer_email TEXT,
  capture_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  captured_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  sync_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Solo lectura de sus propias órdenes para el usuario
DROP POLICY IF EXISTS "orders_select_own" ON public.payment_orders;
CREATE POLICY "orders_select_own"
  ON public.payment_orders
  FOR SELECT
  TO authenticated
  USING (user_id = (auth.uid())::text);

-- Sin inserción ni modificación desde clientes
REVOKE INSERT, UPDATE, DELETE ON public.payment_orders FROM anon, authenticated;
GRANT SELECT ON public.payment_orders TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. TABLA: public.payment_transactions (Asiento Contable y Auditoría)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id TEXT PRIMARY KEY, -- Capture ID de PayPal
  order_id TEXT UNIQUE NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
  service_title TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL CHECK (status IN ('created', 'captured', 'completed', 'failed', 'refunded')),
  provider VARCHAR(50) NOT NULL DEFAULT 'paypal',
  payer_email TEXT,
  reference_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON public.payment_transactions;
CREATE POLICY "transactions_select_own"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = (auth.uid())::text);

REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM anon, authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. PROTECCIÓN DE CAMPOS DESTACADOS EN: public.services
-- ------------------------------------------------------------------------------
-- Como author_id en 'services' es TEXT, cualquier política o trigger maneja
-- compatibilidad con (auth.uid())::text.
CREATE OR REPLACE FUNCTION public.protect_featured_service_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Comprobar si se intentan modificar campos reservados de destacados
  IF (
    NEW.is_featured IS DISTINCT FROM OLD.is_featured OR
    NEW.featured_plan_id IS DISTINCT FROM OLD.featured_plan_id OR
    NEW.featured_plan_name IS DISTINCT FROM OLD.featured_plan_name OR
    NEW.featured_until IS DISTINCT FROM OLD.featured_until
  ) THEN
    -- Si la petición NO proviene del service_role
    IF COALESCE((auth.jwt() ->> 'role'), '') != 'service_role' AND current_user != 'service_role' THEN
      -- Revertir las columnas privilegiadas a su estado original
      NEW.is_featured := OLD.is_featured;
      NEW.featured_plan_id := OLD.featured_plan_id;
      NEW.featured_plan_name := OLD.featured_plan_name;
      NEW.featured_until := OLD.featured_until;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_featured_service_columns ON public.services;
CREATE TRIGGER trg_protect_featured_service_columns
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_featured_service_columns();

-- ------------------------------------------------------------------------------
-- 8. FUNCIÓN RPC TRANSACCIONAL REFORZADA: activate_service_promotion
-- ------------------------------------------------------------------------------
-- Validación estricta completa dentro de una única transacción atómica:
--   1. Valida existencia del servicio y verifica que el propietario coincida
--   2. Valida divisa (EUR) e importe exacto
--   3. Valida que la orden exista en payment_orders y no haya sido reutilizada
--   4. Actualiza services.featured_until (TIMESTAMPTZ nativo)
--   5. Registra el asiento contable en payment_transactions
--   6. Actualiza el estado en payment_orders a 'CAPTURED' y 'synced'

CREATE OR REPLACE FUNCTION public.activate_service_promotion(
  p_order_id TEXT,
  p_capture_id TEXT,
  p_service_id TEXT,
  p_service_title TEXT,
  p_user_id TEXT,
  p_user_name TEXT,
  p_plan_id TEXT,
  p_plan_name TEXT,
  p_amount NUMERIC,
  p_duration_days INTEGER,
  p_expires_at TIMESTAMPTZ,
  p_payer_email TEXT,
  p_currency TEXT DEFAULT 'EUR',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service RECORD;
  v_order RECORD;
  v_tx RECORD;
  v_existing_tx RECORD;
BEGIN
  -- A. Validar divisa (estrictamente EUR)
  IF p_currency != 'EUR' THEN
    RAISE EXCEPTION 'Divisa no permitida: %. Solo se acepta EUR.', p_currency;
  END IF;

  -- B. Validar planes oficiales y correlación estricta de importes y duración
  IF p_plan_id NOT IN ('plan_basic', 'plan_pro', 'plan_premium') THEN
    RAISE EXCEPTION 'Plan de destacado no reconocido: %.', p_plan_id;
  END IF;

  IF (p_plan_id = 'plan_basic' AND (p_amount != 2.99 OR p_duration_days != 3)) OR
     (p_plan_id = 'plan_pro' AND (p_amount != 6.99 OR p_duration_days != 7)) OR
     (p_plan_id = 'plan_premium' AND (p_amount != 14.99 OR p_duration_days != 30)) THEN
    RAISE EXCEPTION 'Discrepancia en tarifa: el plan % requiere importe y duración exactos (recibido: % EUR, % días).', p_plan_id, p_amount, p_duration_days;
  END IF;

  -- C. Validar identificador de captura de PayPal
  IF p_capture_id IS NULL OR length(trim(p_capture_id)) < 4 THEN
    RAISE EXCEPTION 'Identificador de captura de PayPal inválido o ausente.';
  END IF;

  -- D. Validar existencia del servicio y coincidencia estricta de titularidad
  SELECT id, author_id, is_featured INTO v_service
  FROM public.services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El servicio con ID % no existe.', p_service_id;
  END IF;

  IF v_service.author_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Violación de propiedad: el usuario % no es el creador del servicio %.', p_user_id, p_service_id;
  END IF;

  -- E. Evitar reutilización de la misma captura en una orden o servicio distinto
  SELECT id, order_id INTO v_existing_tx
  FROM public.payment_transactions
  WHERE id = p_capture_id;

  IF FOUND AND v_existing_tx.order_id IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'La captura de pago % ya fue liquidada para otra orden de pago (%).', p_capture_id, v_existing_tx.order_id;
  END IF;

  -- F. Validar estado y vinculación en payment_orders
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE order_id = p_order_id;

  IF FOUND THEN
    -- Rechazar si la orden se originó para otro servicio o usuario
    IF v_order.service_id IS DISTINCT FROM p_service_id OR v_order.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Intento de reutilización fraudulenta: la orden % está vinculada a otro servicio (%) o usuario (%).', p_order_id, v_order.service_id, v_order.user_id;
    END IF;

    -- Rechazar si ya fue capturada con un identificador de captura diferente
    IF v_order.status = 'CAPTURED' AND v_order.capture_id IS NOT NULL AND v_order.capture_id IS DISTINCT FROM p_capture_id THEN
      RAISE EXCEPTION 'La orden % ya fue completada con una captura previa distinta (%).', p_order_id, v_order.capture_id;
    END IF;

    -- Rechazar órdenes abortadas o marcadas como fallidas
    IF v_order.status = 'FAILED' THEN
      RAISE EXCEPTION 'La orden % figura en estado fallido y no puede ser reactivada.', p_order_id;
    END IF;
  ELSE
    -- Si la orden no existía en PostgreSQL (ej. modo journal local), registrarla con estado CAPTURING
    INSERT INTO public.payment_orders (
      order_id,
      user_id,
      service_id,
      service_title,
      plan_id,
      plan_name,
      amount,
      currency,
      duration_days,
      status,
      payer_email,
      capture_id,
      expires_at
    )
    VALUES (
      p_order_id,
      p_user_id,
      p_service_id,
      p_service_title,
      p_plan_id,
      p_plan_name,
      p_amount,
      p_currency,
      p_duration_days,
      'CAPTURING',
      p_payer_email,
      p_capture_id,
      p_expires_at
    );
  END IF;

  -- G. Actualizar servicio en public.services (featured_until es TIMESTAMPTZ nativo comprobado)
  UPDATE public.services
  SET
    is_featured = TRUE,
    featured_plan_id = p_plan_id,
    featured_plan_name = p_plan_name,
    featured_until = p_expires_at,
    updated_at = NOW()
  WHERE id = p_service_id;

  -- H. Registrar asiento contable en public.payment_transactions
  INSERT INTO public.payment_transactions (
    id,
    order_id,
    service_id,
    service_title,
    user_id,
    user_name,
    plan_id,
    plan_name,
    amount,
    currency,
    status,
    provider,
    payer_email,
    reference_code,
    created_at,
    expires_at,
    metadata
  )
  VALUES (
    p_capture_id,
    p_order_id,
    p_service_id,
    p_service_title,
    p_user_id,
    p_user_name,
    p_plan_id,
    p_plan_name,
    p_amount,
    p_currency,
    'completed',
    'paypal',
    p_payer_email,
    'PAYPAL-' || UPPER(RIGHT(p_order_id, 8)),
    NOW(),
    p_expires_at,
    p_metadata
  )
  ON CONFLICT (id) DO UPDATE
  SET
    status = 'completed',
    expires_at = EXCLUDED.expires_at
  RETURNING * INTO v_tx;

  -- I. Actualizar payment_orders a estado final CAPTURED y sincronizado
  UPDATE public.payment_orders
  SET
    status = 'CAPTURED',
    capture_id = p_capture_id,
    payer_email = p_payer_email,
    captured_at = NOW(),
    expires_at = p_expires_at,
    sync_status = 'synced',
    sync_error = NULL
  WHERE order_id = p_order_id;

  -- J. Retornar confirmación
  RETURN jsonb_build_object(
    'success', TRUE,
    'orderId', p_order_id,
    'captureId', p_capture_id,
    'serviceId', p_service_id,
    'planId', p_plan_id,
    'expiresAt', p_expires_at,
    'status', 'completed',
    'syncStatus', 'synced'
  );
END;
$$;

-- Restricción estricta de privilegios: Solo invocable por service_role
REVOKE EXECUTE ON FUNCTION public.activate_service_promotion FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_service_promotion TO service_role;
