-- ============================================================================
-- SECURITY FIX 2: Tighten doctor_invite_codes RLS (no broad SELECT of live
-- codes) and reconcile the divergent schema history.
--
-- SCHEMA HISTORY / LIVE SHAPE
-- ---------------------------
-- Two divergent shapes exist in history:
--   * 20260215220502_*  -> (code, created_by, used_by, used_at, is_used, expires_at)
--   * 20260415020135_*  -> (doctor_id, code, max_uses, current_uses, is_active)
-- The 20260415020135 migration is a FULL canonical rebuild of the public schema
-- and is the LATEST authority on this table, so the LIVE shape is:
--     id, doctor_id, code, max_uses, current_uses, is_active, created_at
-- The live schema has exactly ONE policy, "Doctors manage own codes"
-- (FOR ALL: owning doctor OR admin) and RLS enabled. It does NOT expose a
-- broad SELECT to authenticated/anon — good. This migration LOCKS THAT IN and
-- removes any lingering enumeration policies from the old shape defensively.
--
-- WHY: earlier migrations shipped policies like
--   "Anyone can validate unused codes"          USING (is_used = false)
--   "Authenticated can validate invite codes"   USING (is_used = false)
--   "Authenticated can validate specific invite code"
--   "Authenticated users can use a code"        (UPDATE, self-claim)
-- Any SELECT policy of the form USING (is_used = false) / USING (is_active =
-- true) lets any logged-in user ENUMERATE every live invite code and self-grant
-- a privileged doctor/laudista/ophthalmologist role. Invite-code validation
-- must go ONLY through the service-role edge function (assign-role /
-- validate-invite-code), which matches on the secret `code` string. The
-- service_role key bypasses RLS, so no authenticated/anon SELECT policy is
-- needed for that flow at all.
--
-- These DROP POLICY IF EXISTS are idempotent no-ops on the current live DB
-- (the rebuild already removed them); they exist so the security posture is
-- explicit and holds regardless of which historical state a given environment
-- is in.
-- ============================================================================

-- Make sure RLS stays ON no matter what.
ALTER TABLE public.doctor_invite_codes ENABLE ROW LEVEL SECURITY;

-- (a)+(b) Remove ANY broad/self-service SELECT or UPDATE policy for
--          authenticated/anon. Only service_role (which bypasses RLS) and the
--          owner/admin "Doctors manage own codes" policy should remain.
DROP POLICY IF EXISTS "Anyone can validate unused codes"              ON public.doctor_invite_codes;
DROP POLICY IF EXISTS "Authenticated can validate invite codes"       ON public.doctor_invite_codes;
DROP POLICY IF EXISTS "Authenticated can validate specific invite code" ON public.doctor_invite_codes;
DROP POLICY IF EXISTS "Authenticated users can use a code"            ON public.doctor_invite_codes;
DROP POLICY IF EXISTS "Anyone can validate active codes"              ON public.doctor_invite_codes;
DROP POLICY IF EXISTS "Anyone can view active invite codes"           ON public.doctor_invite_codes;
DROP POLICY IF EXISTS "Public can validate invite codes"              ON public.doctor_invite_codes;

-- Reassert the intended admin/owner management policy (idempotent).
DROP POLICY IF EXISTS "Doctors manage own codes" ON public.doctor_invite_codes;
CREATE POLICY "Doctors manage own codes" ON public.doctor_invite_codes
  FOR ALL
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============================================================================
-- REQUIRES (edge-function follow-up) -- schema drift, NOT fixed here:
--
-- The live table uses (max_uses, current_uses, is_active) but the edge
-- functions still target the OLD columns (is_used, used_by, used_at,
-- expires_at):
--   * supabase/functions/assign-role/index.ts
--       .update({ is_used: true, used_by, used_at }).eq("is_used", false)
--       .or("expires_at.is.null,expires_at.gt.<now>")
--   * supabase/functions/validate-invite-code/index.ts
--       .select("id, code, is_used, expires_at").eq("is_used", false) ...
--
-- Against the CURRENT schema those columns do not exist, so the atomic claim
-- fails and no doctor invites can be redeemed. Before deploying, the
-- assign-role / validate-invite-code functions MUST be adapted to the live
-- shape, e.g. claim by incrementing usage under a uses-remaining guard:
--
--   UPDATE public.doctor_invite_codes
--      SET current_uses = current_uses + 1,
--          is_active   = (current_uses + 1) < max_uses
--    WHERE code = :inviteCode
--      AND is_active = true
--      AND current_uses < max_uses
--   RETURNING id;   -- exactly one row => claim won
--
-- (Alternatively, reintroduce is_used/used_by/expires_at columns to match the
-- functions -- but the RLS posture above is correct either way, since all
-- validation runs through the service-role client which bypasses RLS.)
-- No broad authenticated/anon SELECT should ever be re-added to this table.
-- ============================================================================
