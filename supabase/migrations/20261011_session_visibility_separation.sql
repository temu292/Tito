-- ==============================================================================
-- VECINOYA - MIGRACIÓN INCREMENTAL: SEPARACIÓN DE ESTADO EDITORIAL Y SESIÓN
-- Archivo: supabase/migrations/20261011_session_visibility_separation.sql
-- ==============================================================================
-- Objetivo:
--   Separar estrictamente en `public.services`:
--     1. Estado editorial / moderación (`status`: 'active', 'draft', 'suspended')
--     2. Visibilidad temporal derivada de la sesión (`owner_session_active`: boolean)
--
--   De este modo:
--     - Cerrar sesión pone `owner_session_active = FALSE` sin alterar `status`.
--     - Iniciar sesión pone `owner_session_active = TRUE` sin publicar borradores
--       (`status = 'draft'` nunca pasa automáticamente a `'active'`).
--     - Supabase RLS bloquea en base de datos la lectura pública de anuncios cuyo
--       propietario haya cerrado sesión (`owner_session_active = FALSE`) o que
--       estén en borrador (`status != 'active'`).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. COLUMNAS DE VISIBILIDAD DE SESIÓN EN `public.services`
-- ------------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS owner_session_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS owner_session_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Índice compuesto para acelerar los listados públicos filtrados por RLS
CREATE INDEX IF NOT EXISTS idx_services_public_session_visibility
  ON public.services (status, owner_session_active, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. POLÍTICAS RLS EN `public.services`
-- ------------------------------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Lectura (SELECT):
--   - Cualquier usuario (anon o authenticated) puede ver anuncios que estén
--     simultáneamente publicados (`status = 'active'`) y con sesión activa del
--     propietario (`owner_session_active = TRUE`).
--   - El propietario autenticado (`(auth.uid())::text = author_id`) puede leer
--     todos sus propios anuncios (incluidos borradores `status = 'draft'`) para
--     poder gestionarlos desde su perfil.
DROP POLICY IF EXISTS "services_select_public" ON public.services;
CREATE POLICY "services_select_public"
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'active' AND owner_session_active = TRUE)
    OR (auth.uid())::text = author_id
  );

-- Inserción (INSERT):
--   - Solo usuarios autenticados pueden crear anuncios bajo su propio `author_id`.
DROP POLICY IF EXISTS "services_insert_own" ON public.services;
CREATE POLICY "services_insert_own"
  ON public.services
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = author_id);

-- Actualización (UPDATE):
--   - Solo el propietario autenticado puede actualizar sus propios anuncios
--     (tanto datos editoriales como `owner_session_active`).
DROP POLICY IF EXISTS "services_update_own" ON public.services;
CREATE POLICY "services_update_own"
  ON public.services
  FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = author_id)
  WITH CHECK ((auth.uid())::text = author_id);

-- Eliminación (DELETE):
--   - Solo el propietario autenticado puede eliminar físicamente su propio anuncio.
DROP POLICY IF EXISTS "services_delete_own" ON public.services;
CREATE POLICY "services_delete_own"
  ON public.services
  FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = author_id);

-- ------------------------------------------------------------------------------
-- 3. FUNCIÓN RPC PARA ACTUALIZAR LA VISIBILIDAD DE SESIÓN DEL PROPIETARIO
-- ------------------------------------------------------------------------------
-- Actualiza únicamente `owner_session_active` y `owner_session_updated_at`
-- para los anuncios del usuario autenticado (`auth.uid()`), sin modificar jamás
-- el estado editorial (`status`).
CREATE OR REPLACE FUNCTION public.set_owner_session_visibility(p_is_active BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_updated_count INTEGER;
BEGIN
  v_uid := (auth.uid())::text;
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'Debes tener una sesión autenticada para cambiar la visibilidad de sesión.';
  END IF;

  UPDATE public.services
  SET
    owner_session_active = p_is_active,
    owner_session_updated_at = NOW()
  WHERE author_id = v_uid
    AND owner_session_active IS DISTINCT FROM p_is_active;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_owner_session_visibility(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_owner_session_visibility(BOOLEAN) TO authenticated, service_role;

COMMIT;
