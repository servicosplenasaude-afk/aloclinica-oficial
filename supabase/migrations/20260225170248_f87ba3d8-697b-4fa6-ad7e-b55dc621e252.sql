INSERT INTO public.doctor_profiles (user_id, crm, crm_state, crm_verified, is_approved, bio)
SELECT id, 'ADMIN-0001', 'RR', true, true, 'Administrador Master da Plataforma'
FROM auth.users
WHERE id = 'a5c1ac9a-5368-4429-83a0-85e2b3d4a353'
ON CONFLICT DO NOTHING;
