UPDATE public.kyc_sessions
SET status = 'approved',
    match_score = 1.0,
    updated_at = now()
WHERE user_id = '77c528d4-c8b4-4e7f-8678-dabef20b5a44';

INSERT INTO public.kyc_sessions (user_id, role, status, token, match_score, expires_at)
SELECT '77c528d4-c8b4-4e7f-8678-dabef20b5a44', 'admin', 'approved',
       encode(extensions.gen_random_bytes(16), 'hex'), 1.0, now() + interval '10 years'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kyc_sessions
  WHERE user_id = '77c528d4-c8b4-4e7f-8678-dabef20b5a44' AND status = 'approved' AND role = 'admin'
);
