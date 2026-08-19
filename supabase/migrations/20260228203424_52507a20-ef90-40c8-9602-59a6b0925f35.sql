
-- Plans with proper UUIDs
INSERT INTO public.plans (id, name, description, price, interval, is_active, max_appointments, features) VALUES
  ('a0000000-0001-4000-8000-000000000001', 'Básico', 'Plano ideal para consultas esporádicas', 49.90, 'monthly', true, 2, '["2 consultas/mês", "Chat com médico", "Receitas digitais"]'::jsonb),
  ('a0000000-0002-4000-8000-000000000002', 'Premium', 'Acesso ilimitado a teleconsultas', 99.90, 'monthly', true, null, '["Consultas ilimitadas", "Prioridade no atendimento", "Cartão de desconto", "Chat 24h"]'::jsonb),
  ('a0000000-0003-4000-8000-000000000003', 'Família', 'Plano para toda a família', 149.90, 'monthly', true, null, '["Até 5 dependentes", "Consultas ilimitadas", "Prioridade total", "Desconto em exames"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Legacy demonstration data below references users from the original project.
-- Keep fresh environments portable by inserting it only when those principals
-- actually exist; sandbox test data is created by seed-test-users instead.
DO $$
BEGIN
IF (
  SELECT count(*) FROM auth.users
  WHERE id IN (
    'bc5ed973-4764-4229-a4e5-4d06435f0e70',
    'a5c1ac9a-5368-4429-83a0-85e2b3d4a353',
    '38dae434-500c-43db-b0c1-a1f4d0a4ad67',
    '0f4b19af-687a-40c7-b510-aebe2269f17b',
    'e4483e14-aea8-417b-81ff-02f3cbb502f2'
  )
) = 5 THEN

-- Appointments
INSERT INTO public.appointments (id, doctor_id, patient_id, scheduled_at, status, payment_status, price_at_booking, appointment_type, notes) VALUES
  ('b0000000-0001-4000-8000-000000000001', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', now() - interval '7 days', 'completed', 'approved', 89, 'teleconsulta', 'Consulta de rotina - paciente estável'),
  ('b0000000-0002-4000-8000-000000000002', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', now() - interval '3 days', 'completed', 'approved', 89, 'teleconsulta', 'Retorno - exames normais'),
  ('b0000000-0003-4000-8000-000000000003', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', now() + interval '2 days', 'confirmed', 'approved', 89, 'teleconsulta', null),
  ('b0000000-0004-4000-8000-000000000004', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', now() + interval '7 days', 'scheduled', 'pending', 89, 'teleconsulta', null),
  ('b0000000-0005-4000-8000-000000000005', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'a5c1ac9a-5368-4429-83a0-85e2b3d4a353', now() - interval '1 day', 'completed', 'approved', 89, 'teleconsulta', 'Admin como paciente')
ON CONFLICT (id) DO NOTHING;

-- Prescriptions
INSERT INTO public.prescriptions (id, appointment_id, doctor_id, patient_id, diagnosis, medications, observations) VALUES
  ('c0000000-0001-4000-8000-000000000001', 'b0000000-0001-4000-8000-000000000001', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'Hipertensão arterial leve', '[{"name":"Losartana 50mg","dosage":"1 comprimido","frequency":"1x ao dia","duration":"30 dias"},{"name":"Hidroclorotiazida 25mg","dosage":"1 comprimido","frequency":"1x ao dia","duration":"30 dias"}]'::jsonb, 'Retorno em 30 dias com exames de função renal'),
  ('c0000000-0002-4000-8000-000000000002', 'b0000000-0002-4000-8000-000000000002', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'Gripe', '[{"name":"Paracetamol 750mg","dosage":"1 comprimido","frequency":"6/6h","duration":"5 dias"}]'::jsonb, 'Repouso e hidratação')
ON CONFLICT (id) DO NOTHING;

-- Consultation notes
INSERT INTO public.consultation_notes (appointment_id, doctor_id, content) VALUES
  ('b0000000-0001-4000-8000-000000000001', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'Paciente refere cefaleia eventual e tontura. PA 145x90. Solicito exames laboratoriais.'),
  ('b0000000-0002-4000-8000-000000000002', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'Retorno com exames normais. PA controlada 120x80. Manter medicação atual.');

-- Medical records
INSERT INTO public.medical_records (patient_id, doctor_id, appointment_id, record_type, title, description, severity, is_active) VALUES
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'b0000000-0001-4000-8000-000000000001', 'condition', 'Hipertensão Arterial', 'Hipertensão leve diagnosticada', 'mild', true),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', null, null, 'allergy', 'Alergia a Dipirona', 'Reação alérgica - urticária', 'moderate', true);

-- Subscription
INSERT INTO public.subscriptions (id, user_id, plan_id, status, starts_at, current_period_end, payment_method) VALUES
  ('d0000000-0001-4000-8000-000000000001', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'a0000000-0002-4000-8000-000000000002', 'active', now() - interval '15 days', now() + interval '15 days', 'pix')
ON CONFLICT (id) DO NOTHING;

-- Discount card
INSERT INTO public.discount_cards (id, user_id, plan_type, discount_percent, price_monthly, status, valid_until) VALUES
  ('e0000000-0001-4000-8000-000000000001', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'premium', 30, 29.90, 'active', now() + interval '30 days')
ON CONFLICT (id) DO NOTHING;

-- Surveys
INSERT INTO public.satisfaction_surveys (appointment_id, doctor_id, patient_id, nps_score, quality_score, ease_score, comment, would_recommend) VALUES
  ('b0000000-0001-4000-8000-000000000001', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 9, 5, 5, 'Excelente atendimento!', true),
  ('b0000000-0002-4000-8000-000000000002', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 8, 4, 5, 'Muito bom!', true);

-- Exam requests
INSERT INTO public.exam_requests (id, requesting_doctor_id, patient_id, exam_type, status, priority, clinical_info, file_urls, specialty_required) VALUES
  ('f0000000-0001-4000-8000-000000000001', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'Eletrocardiograma', 'pending', 'normal', 'Paciente hipertenso. Avaliar sobrecarga.', '[]'::jsonb, 'Cardiologia'),
  ('f0000000-0002-4000-8000-000000000002', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'Raio-X Tórax', 'reported', 'normal', 'Tosse persistente.', '[]'::jsonb, null),
  ('f0000000-0003-4000-8000-000000000003', '13e95540-3dc7-4dd0-81a5-5d8086375784', 'a5c1ac9a-5368-4429-83a0-85e2b3d4a353', 'Hemograma Completo', 'pending', 'urgent', 'Fadiga intensa e palidez.', '[]'::jsonb, null);

-- Exam report
INSERT INTO public.exam_reports (exam_request_id, reporter_id, content_text, signed_at, verification_code) VALUES
  ('f0000000-0002-4000-8000-000000000002', 'e4483e14-aea8-417b-81ff-02f3cbb502f2', 'LAUDO RADIOLÓGICO - Raio-X Tórax PA e Perfil. Campos pulmonares normais. Seios costofrênicos livres. Área cardíaca normal. CONCLUSÃO: Exame dentro da normalidade.', now() - interval '1 day', 'VER-ABCD1234');

-- Notifications
INSERT INTO public.notifications (user_id, title, message, type, link, is_read) VALUES
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', '📅 Consulta agendada', 'Sua consulta com Dr. Carlos está confirmada.', 'appointment', '/dashboard/appointments', false),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', '💊 Receita disponível', 'Sua receita de Losartana está pronta.', 'prescription', '/dashboard/paciente/prescriptions', false),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', '🔬 Laudo pronto', 'O laudo do Raio-X de Tórax está disponível.', 'exam', '/dashboard/paciente/health', true),
  ('38dae434-500c-43db-b0c1-a1f4d0a4ad67', '✅ Consulta confirmada', 'Pagamento de Ana Paciente confirmado.', 'appointment', '/dashboard/appointments', false),
  ('0f4b19af-687a-40c7-b510-aebe2269f17b', '🔬 Exame atribuído', 'Eletrocardiograma atribuído para laudo.', 'exam', '/dashboard/laudista/queue', false),
  ('a5c1ac9a-5368-4429-83a0-85e2b3d4a353', '📊 Lead B2B pendente', 'Hospital São Lucas aguarda resposta.', 'warning', '/dashboard?tab=b2b', false);

-- Health metrics
INSERT INTO public.health_metrics (patient_id, type, value, unit, measured_at) VALUES
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'blood_pressure_systolic', 145, 'mmHg', now() - interval '7 days'),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'blood_pressure_diastolic', 90, 'mmHg', now() - interval '7 days'),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'blood_pressure_systolic', 120, 'mmHg', now()),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'blood_pressure_diastolic', 80, 'mmHg', now()),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'weight', 75.5, 'kg', now() - interval '7 days'),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'weight', 75.2, 'kg', now()),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'heart_rate', 72, 'bpm', now());

-- B2B Leads
INSERT INTO public.b2b_leads (company_name, company_type, contact_name, email, phone, services_interested, status, message) VALUES
  ('Hospital São Lucas', 'hospital', 'Roberto Silva', 'roberto@saolucas.com.br', '(11) 3333-4444', '["telelaudo", "teleconsulta"]'::jsonb, 'new', 'Interesse em telelaudo para centro de imagem.'),
  ('Clínica Vida Nova', 'clinic', 'Mariana Costa', 'mariana@vidanova.com', '(21) 2222-3333', '["teleconsulta"]'::jsonb, 'contacted', 'Teleconsulta para pacientes.'),
  ('Farmácia Popular Plus', 'pharmacy', 'Antonio Gomes', 'antonio@popular.com', '(31) 4444-5555', '["cartao_desconto"]'::jsonb, 'new', null);

-- Health tips
INSERT INTO public.health_tips (title, content, category, icon, is_active) VALUES
  ('Hidratação é fundamental', 'Beba pelo menos 2 litros de água por dia.', 'wellness', '💧', true),
  ('Durma bem', 'Adultos precisam de 7 a 9 horas de sono.', 'sleep', '😴', true),
  ('Exercício regular', '150 minutos de atividade moderada por semana.', 'fitness', '🏃', true);

-- Coupons
INSERT INTO public.coupons (code, discount_percentage, max_uses, is_active, expires_at, created_by) VALUES
  ('PRIMEIRA10', 10, 100, true, now() + interval '90 days', 'a5c1ac9a-5368-4429-83a0-85e2b3d4a353'),
  ('AMIGO20', 20, 50, true, now() + interval '60 days', 'a5c1ac9a-5368-4429-83a0-85e2b3d4a353'),
  ('BLACKFRIDAY', 30, 200, true, now() + interval '30 days', 'a5c1ac9a-5368-4429-83a0-85e2b3d4a353');

-- Messages
INSERT INTO public.messages (appointment_id, sender_id, content, is_read) VALUES
  ('b0000000-0003-4000-8000-000000000003', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'Olá doutor, confirmando minha consulta.', true),
  ('b0000000-0003-4000-8000-000000000003', '38dae434-500c-43db-b0c1-a1f4d0a4ad67', 'Confirmado! Nos vemos no horário. 😊', true);

-- Referrals
INSERT INTO public.referrals (referrer_id, referral_code, status, source) VALUES
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'ANA123', 'pending', 'whatsapp'),
  ('a5c1ac9a-5368-4429-83a0-85e2b3d4a353', 'ADMIN1', 'converted', 'email');

-- Pre-consultation
INSERT INTO public.pre_consultation_symptoms (appointment_id, patient_id, main_complaint, symptoms, severity, duration) VALUES
  ('b0000000-0003-4000-8000-000000000003', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'Dor de cabeça frequente', ARRAY['cefaleia', 'tontura', 'fadiga'], 'moderate', '2 semanas');

-- Dependents
INSERT INTO public.dependents (user_id, name, relationship, date_of_birth, cpf) VALUES
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'João Paciente Jr.', 'filho', '2018-05-15', '123.456.789-00'),
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', 'Maria Paciente', 'cônjuge', '1992-03-20', '987.654.321-00');

-- Favorite doctors
INSERT INTO public.favorite_doctors (patient_id, doctor_id) VALUES
  ('bc5ed973-4764-4229-a4e5-4d06435f0e70', '13e95540-3dc7-4dd0-81a5-5d8086375784');

-- Newsletter
INSERT INTO public.newsletter_subscribers (email, source) VALUES
  ('ana@teste.com', 'landing'),
  ('carlos@teste.com', 'footer');

-- Report templates
INSERT INTO public.report_templates (created_by, exam_type, title, body_text, is_active) VALUES
  ('0f4b19af-687a-40c7-b510-aebe2269f17b', 'Eletrocardiograma', 'ECG Normal', 'Ritmo sinusal regular. FC: ___bpm. Eixo normal. Sem alterações ST-T. CONCLUSÃO: ECG normal.', true),
  ('0f4b19af-687a-40c7-b510-aebe2269f17b', 'Raio-X Tórax', 'RX Tórax Normal', 'Campos pulmonares normais. Seios livres. Mediastino centrado. CONCLUSÃO: Normal.', true);

-- Activity logs
INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details) VALUES
  ('appointment_created', 'appointment', 'b0000000-0001-4000-8000-000000000001', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', '{"status":"scheduled"}'::jsonb),
  ('appointment_status_change', 'appointment', 'b0000000-0001-4000-8000-000000000001', '38dae434-500c-43db-b0c1-a1f4d0a4ad67', '{"old_status":"scheduled","new_status":"completed"}'::jsonb),
  ('login', 'user', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', 'bc5ed973-4764-4229-a4e5-4d06435f0e70', '{"method":"email"}'::jsonb);

END IF;
END
$$;
