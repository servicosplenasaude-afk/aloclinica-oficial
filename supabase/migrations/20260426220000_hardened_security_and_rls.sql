-- ============================================================================
-- MASTER DATABASE SECURITY & CONFIGURATION
-- Ensures complete security, RLS, and consistent policies across the DB.
-- ============================================================================

-- 1. ENABLE RLS ON ALL TABLES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- 2. SCHEMA HARDENING
REVOKE ALL ON SCHEMA public FROM public;
REVOKE ALL ON SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO service_role;

-- 3. CORE IDENTITY POLICIES

-- PROFILES
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view all basic profiles" ON public.profiles;
  CREATE POLICY "Users can view all basic profiles" ON public.profiles FOR SELECT USING (true);
  
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
END $$;

-- DOCTOR PROFILES
DO $$ BEGIN
  DROP POLICY IF EXISTS "Approved doctors are public" ON public.doctor_profiles;
  CREATE POLICY "Approved doctors are public" ON public.doctor_profiles FOR SELECT USING (is_approved = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  
  DROP POLICY IF EXISTS "Doctors manage own profile" ON public.doctor_profiles;
  CREATE POLICY "Doctors manage own profile" ON public.doctor_profiles FOR UPDATE USING (auth.uid() = user_id);
END $$;

-- 4. MEDICAL DATA SECURITY (EXAMES & LAUDOS)

-- EXAMES
DO $$ BEGIN
  DROP POLICY IF EXISTS "Access exames" ON public.aloc_exames;
  CREATE POLICY "Access exames" ON public.aloc_exames FOR SELECT USING (
    auth.uid() = paciente_id
    OR auth.uid() = medico_solicitante_id
    OR auth.uid() = laudista_id
    OR public.has_role(auth.uid(), 'admin')
  );
END $$;

-- LAUDOS
DO $$ BEGIN
  DROP POLICY IF EXISTS "Access laudos" ON public.aloc_laudos;
  CREATE POLICY "Access laudos" ON public.aloc_laudos FOR SELECT USING (
    auth.uid() = medico_id
    OR EXISTS (SELECT 1 FROM public.aloc_exames e WHERE e.id = exame_id AND (
      e.paciente_id = auth.uid()
      OR e.medico_solicitante_id = auth.uid()
      OR e.laudista_id = auth.uid()
    ))
    OR public.has_role(auth.uid(), 'admin')
  );
END $$;

-- MEDICAL RECORDS
DO $$ BEGIN
  DROP POLICY IF EXISTS "Access medical records" ON public.medical_records;
  CREATE POLICY "Access medical records" ON public.medical_records FOR SELECT USING (
    auth.uid() = patient_id 
    OR EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = doctor_id AND dp.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
END $$;

-- 5. FINANCIAL & WALLET SECURITY

-- WALLET TRANSACTIONS
DO $$ BEGIN
  DROP POLICY IF EXISTS "Access wallet" ON public.wallet_transactions;
  CREATE POLICY "Access wallet" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
END $$;

-- 6. APPOINTMENTS SECURITY
DO $$ BEGIN
  DROP POLICY IF EXISTS "Access appointments" ON public.appointments;
  CREATE POLICY "Access appointments" ON public.appointments FOR SELECT USING (
    auth.uid() = patient_id 
    OR EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = doctor_id AND dp.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
END $$;

-- 7. AUDIT & LOGGING
DO $$ BEGIN
  -- Activity logs should be readable by owner or admin
  DROP POLICY IF EXISTS "Read activity logs" ON public.activity_logs;
  CREATE POLICY "Read activity logs" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  
  -- Prevent deletion or update of audit logs
  DROP POLICY IF EXISTS "No modifications to audit logs" ON public.activity_logs;
  CREATE POLICY "No modifications to audit logs" ON public.activity_logs FOR UPDATE USING (false);
  CREATE POLICY "No deletions to audit logs" ON public.activity_logs FOR DELETE USING (false);
END $$;

-- 8. SYSTEM FUNCTIONS
CREATE OR REPLACE FUNCTION public.handle_new_user_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (NEW.id, split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1), split_part(NEW.raw_user_meta_data->>'full_name', ' ', 2))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. PERMISSION LOCKDOWN (Final)
-- Anon should only see what is strictly necessary (like specialties, site_config)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        IF t NOT IN ('specialties', 'site_config', 'specialty_categories', 'languages', 'faqs', 'testimonials', 'blog_posts', 'blog_categories') THEN
            EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        END IF;
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
