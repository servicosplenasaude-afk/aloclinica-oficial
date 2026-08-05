-- Expõe education / experience_years / short_description no view público
-- (antes eram NULL fixos — o perfil público do médico nunca mostrava esses
-- campos, mesmo depois de o médico preencher). Definição copiada VERBATIM da
-- migration 20260525171036; só os 3 literais NULL viram as colunas reais.
-- Mesmos nomes/ordem/tipos → CREATE OR REPLACE é seguro.
CREATE OR REPLACE VIEW public.doctor_profiles_public AS
SELECT dp.id,
    COALESCE(NULLIF(TRIM(BOTH FROM (COALESCE(p.first_name, ''::text) || ' '::text) || COALESCE(p.last_name, ''::text)), ''::text), dp.display_name) AS full_name,
    dp.display_name,
    COALESCE(dp.professional_photo_url, p.avatar_url) AS avatar_url,
    dp.crm,
    dp.crm_state,
    COALESCE(dp.crm_verified, false) AS crm_verified,
    dp.bio,
    dp.short_description,
    dp.price AS consultation_price,
    dp.consultation_duration AS consultation_duration_min,
    COALESCE(dp.rating_avg, 0::numeric) AS rating,
    COALESCE(dp.rating_count, 0) AS total_reviews,
    dp.experience_years,
    COALESCE(dp.is_on_duty, false) AS available_now,
    dp.doctor_type = 'telemedicina'::text AS available_for_telemedicine,
    dp.areas_of_expertise AS sub_specialties,
    dp.education,
    dp.doctor_type,
    COALESCE(dp.council_type::text, 'CRM'::text) AS council_type,
    COALESCE(ARRAY(
      SELECT s.name FROM doctor_specialties ds
      JOIN specialties s ON s.id = ds.specialty_id
      WHERE ds.doctor_id = dp.id ORDER BY s.name
    ), ARRAY[]::text[]) AS specialty_names,
    (EXISTS (SELECT 1 FROM availability_slots a
             WHERE a.doctor_id = dp.id AND COALESCE(a.is_active, true) = true)) AS has_availability
FROM doctor_profiles dp
LEFT JOIN profiles p ON p.user_id = dp.user_id
WHERE COALESCE(dp.is_approved, false) = true AND COALESCE(dp.is_active, false) = true;
