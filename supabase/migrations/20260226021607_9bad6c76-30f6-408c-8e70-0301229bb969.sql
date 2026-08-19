INSERT INTO appointments (
  doctor_id, 
  patient_id, 
  scheduled_at, 
  status, 
  appointment_type,
  jitsi_link,
  video_room_url
) SELECT
  'ca9d8233-f594-431d-865b-e1ab312ca0da',
  'a5c1ac9a-5368-4429-83a0-85e2b3d4a353',
  now() + interval '2 minutes',
  'scheduled',
  'telemedicina',
  'https://meet.jit.si/AlloMedicoConsultaTeste001',
  'https://meet.jit.si/AlloMedicoConsultaTeste001'
WHERE EXISTS (
  SELECT 1 FROM public.doctor_profiles
  WHERE id = 'ca9d8233-f594-431d-865b-e1ab312ca0da'
)
AND EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = 'a5c1ac9a-5368-4429-83a0-85e2b3d4a353'
);
