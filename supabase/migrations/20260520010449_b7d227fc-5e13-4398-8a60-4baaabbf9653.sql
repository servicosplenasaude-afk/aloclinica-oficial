
DROP VIEW IF EXISTS public.doctor_profiles_public CASCADE;

CREATE VIEW public.doctor_profiles_public AS
SELECT
  dp.id,
  COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), dp.full_name) AS full_name,
  dp.full_name AS display_name,
  COALESCE(dp.avatar_url, p.avatar_url) AS avatar_url,
  dp.crm,
  dp.crm_state,
  COALESCE(dp.crm_verified, false) AS crm_verified,
  dp.bio,
  NULL::text AS short_description,
  dp.consultation_price,
  dp.consultation_duration_min,
  COALESCE(dp.rating, 0) AS rating,
  COALESCE(dp.total_reviews, 0) AS total_reviews,
  dp.experience_years,
  COALESCE(dp.available_now, false) AS available_now,
  dp.available_for_telemedicine,
  dp.sub_specialties,
  dp.education,
  dp.doctor_type,
  COALESCE(
    ARRAY(
      SELECT s.name
      FROM public.doctor_specialties ds
      JOIN public.specialties s ON s.id = ds.specialty_id
      WHERE ds.doctor_id = dp.id
      ORDER BY s.name
    ),
    ARRAY[]::text[]
  ) AS specialty_names,
  EXISTS(
    SELECT 1 FROM public.availability_slots a
    WHERE a.doctor_id = dp.id AND COALESCE(a.is_active, true) = true
  ) AS has_availability
FROM public.doctor_profiles dp
LEFT JOIN public.profiles p ON p.user_id = dp.user_id
WHERE COALESCE(dp.is_approved, false) = true;

GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;
