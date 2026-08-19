
DO $seed$
DECLARE
  v_user UUID := '77c528d4-c8b4-4e7f-8678-dabef20b5a44';
  v_doc1 UUID := 'dfeb4c22-c978-4097-ae3e-6e93dd46fa24';
  v_doc2 UUID := 'e9903fb1-03be-42be-8174-1d59830b477b';
  v_doc3 UUID := 'faea37ab-0caf-4b91-9cbf-d1bd7b4f83b6';
  v_doc1_user UUID := 'c8d71512-5b54-452f-9802-de479be986da';
  v_clinica UUID;
  v_cardio UUID;
  v_derma UUID;
  v_pedi UUID;
  v_nutri UUID;
  v_plan_premium UUID := '0de6eace-c748-4a2f-bcba-c029ec031eea';
  v_sub UUID; v_acct UUID;
  v_appt1 UUID; v_appt2 UUID; v_appt3 UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user)
     OR NOT EXISTS (SELECT 1 FROM doctor_profiles WHERE id IN (v_doc1, v_doc2, v_doc3)) THEN
    RAISE NOTICE 'Skipping legacy demo seed because its fixed users are absent';
    RETURN;
  END IF;

  SELECT id INTO v_clinica FROM specialties WHERE name ILIKE '%clínica%' LIMIT 1;
  SELECT id INTO v_cardio FROM specialties WHERE name ILIKE '%cardio%' LIMIT 1;
  SELECT id INTO v_derma FROM specialties WHERE name ILIKE '%derma%' LIMIT 1;
  SELECT id INTO v_pedi FROM specialties WHERE name ILIKE '%pedia%' LIMIT 1;
  SELECT id INTO v_nutri FROM specialties WHERE name ILIKE '%nutri%' LIMIT 1;
  UPDATE doctor_profiles SET bio='Médico clínico geral com 10+ anos de experiência. Atendimento humanizado via telemedicina.',
    price=89, crm=COALESCE(crm,'CRM-12345-SP'), crm_state=COALESCE(crm_state,'SP'), crm_verified=true,
    slug=COALESCE(slug,'carlos-medico'),
    professional_photo_url=COALESCE(professional_photo_url,'https://i.pravatar.cc/300?img=12'),
    rating_avg=4.9, rating_count=187, kyc_status='approved', is_approved=true, is_active=true WHERE id=v_doc1;
  UPDATE doctor_profiles SET bio='Cardiologista e clínico geral. Foco em prevenção e doenças crônicas.',
    price=129, crm=COALESCE(crm,'CRM-87654-RJ'), crm_state=COALESCE(crm_state,'RJ'), crm_verified=true,
    slug=COALESCE(slug,'dr-teste-silva'),
    professional_photo_url=COALESCE(professional_photo_url,'https://i.pravatar.cc/300?img=33'),
    rating_avg=4.7, rating_count=92, kyc_status='approved', is_approved=true, is_active=true WHERE id=v_doc2;
  UPDATE doctor_profiles SET bio='Dermatologista. Tratamento de acne, manchas, queda capilar e dermatites.',
    price=149, crm=COALESCE(crm,'CRM-44556-MG'), crm_state=COALESCE(crm_state,'MG'), crm_verified=true,
    slug=COALESCE(slug,'fernanda-laudista'),
    professional_photo_url=COALESCE(professional_photo_url,'https://i.pravatar.cc/300?img=47'),
    rating_avg=4.8, rating_count=134, kyc_status='approved', is_approved=true, is_active=true WHERE id=v_doc3;

  INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES
    (v_doc1,v_clinica),(v_doc1,v_pedi),(v_doc2,v_clinica),(v_doc2,v_cardio),(v_doc3,v_derma),(v_doc3,v_nutri)
  ON CONFLICT DO NOTHING;

  DELETE FROM availability_slots WHERE doctor_id IN (v_doc1,v_doc2,v_doc3);
  INSERT INTO availability_slots (doctor_id, day_of_week, start_time, end_time, is_active)
  SELECT d, dow, t.s, t.e, true FROM (VALUES (v_doc1),(v_doc2),(v_doc3)) docs(d)
  CROSS JOIN generate_series(1,5) dow
  CROSS JOIN (VALUES (TIME '08:00',TIME '12:00'),(TIME '14:00',TIME '18:00')) t(s,e);

  INSERT INTO appointments (patient_id,doctor_id,scheduled_at,status,appointment_type,duration_minutes,price,price_at_booking,payment_status,notes,started_at,ended_at,payment_confirmed_at)
  VALUES (v_user,v_doc1,now()-interval '14 days','completed','first_visit',30,89,89,'approved',
    'Cefaleia frequente. Exames solicitados.',now()-interval '14 days',now()-interval '14 days'+interval '28 min',now()-interval '14 days'-interval '1 hour')
  RETURNING id INTO v_appt1;

  INSERT INTO appointments (patient_id,doctor_id,scheduled_at,status,appointment_type,duration_minutes,price,price_at_booking,payment_status,notes,started_at,ended_at,payment_confirmed_at)
  VALUES (v_user,v_doc3,now()-interval '5 days','completed','first_visit',30,149,149,'approved',
    'Consulta dermatológica - tratamento de acne.',now()-interval '5 days',now()-interval '5 days'+interval '32 min',now()-interval '5 days'-interval '30 min')
  RETURNING id INTO v_appt2;

  INSERT INTO appointments (patient_id,doctor_id,scheduled_at,status,appointment_type,duration_minutes,price,price_at_booking,payment_status,payment_confirmed_at)
  VALUES (v_user,v_doc2,now()+interval '3 days','confirmed','return',30,129,129,'approved',now()-interval '1 hour') RETURNING id INTO v_appt3;

  INSERT INTO appointments (patient_id,doctor_id,scheduled_at,status,appointment_type,duration_minutes,price,price_at_booking,payment_status)
  VALUES (v_user,v_doc1,now()+interval '7 days','scheduled','first_visit',30,89,89,'pending');

  INSERT INTO appointments (patient_id,doctor_id,scheduled_at,status,appointment_type,duration_minutes,price,price_at_booking,payment_status,cancel_reason,cancelled_by)
  VALUES (v_user,v_doc3,now()-interval '20 days','cancelled','first_visit',30,149,149,'refunded','Cancelado pelo paciente',v_user);

  INSERT INTO prescriptions (patient_id,doctor_id,appointment_id,prescription_type,medications,instructions,diagnosis,is_signed,signed_at,valid_until,verification_code,status)
  VALUES (v_user,v_doc1,v_appt1,'simple',
    jsonb_build_array(jsonb_build_object('name','Dipirona 500mg','dosage','1 cp 6/6h','duration','5 dias'),
                      jsonb_build_object('name','Omeprazol 20mg','dosage','1 cp em jejum','duration','30 dias')),
    'Tomar com água. Evitar álcool.','Cefaleia tensional + Gastrite',true,now()-interval '14 days',
    (now()+interval '30 days')::date,'RX-'||substr(md5(random()::text),1,8),'finalized');

  INSERT INTO prescriptions (patient_id,doctor_id,appointment_id,prescription_type,medications,instructions,diagnosis,is_signed,signed_at,valid_until,verification_code,status,is_continuous,continuous_duration_days)
  VALUES (v_user,v_doc3,v_appt2,'simple',
    jsonb_build_array(jsonb_build_object('name','Adapaleno gel 0.1%','dosage','À noite','duration','90 dias')),
    'Uso tópico após higienização. Protetor solar diário.','Acne grau II',true,now()-interval '5 days',
    (now()+interval '90 days')::date,'RX-'||substr(md5(random()::text),1,8),'finalized',true,90);

  INSERT INTO medical_certificates (appointment_id,doctor_id,patient_id,type,patient_name,doctor_name,doctor_crm,days,reason,cid,verification_code,issued_at)
  VALUES (v_appt1,v_doc1_user,v_user,'absence','Gustavo Lopes','Dr. Carlos Médico','CRM-12345-SP',2,
    'Cefaleia + gastrite aguda','R51','AT-'||substr(md5(random()::text),1,8),now()-interval '14 days');

  INSERT INTO medical_records (patient_id,doctor_id,appointment_id,record_type,chief_complaint,history_present_illness,assessment,plan,soap_subjective,soap_objective,soap_assessment,soap_plan,is_draft,vitals)
  VALUES (v_user,v_doc1,v_appt1,'consultation','Dor de cabeça há 3 semanas',
    'Cefaleia tensional, piora à tarde, associada a estresse.','Cefaleia tensional + gastrite reativa.',
    'Dipirona SOS, Omeprazol 30d. Retorno em 30d.','Cefaleia há 3 semanas, piora à tarde.','PA 120x80, FC 78, SatO2 98%.',
    'Cefaleia tensional + gastrite.','Dipirona, Omeprazol, retorno em 30d.',false,
    jsonb_build_object('pa','120x80','fc',78,'sat',98,'temp',36.5));

  DELETE FROM pingo_card_subscriptions WHERE user_id=v_user;
  INSERT INTO pingo_card_subscriptions
    (user_id,plan_id,card_number,status,billing_cycle,started_at,current_period_end,next_charge_at,dependents_included,card_holder_name,total_savings,mp_preapproval_id)
  VALUES (v_user,v_plan_premium,'7821 '||lpad((floor(random()*99999999))::text,8,'0'),
    'active','monthly',now()-interval '45 days',now()+interval '15 days',now()+interval '15 days',
    2,'GUSTAVO LOPES',287.50,'test-preapproval-'||substr(md5(random()::text),1,10))
  RETURNING id INTO v_sub;

  INSERT INTO pingo_card_invoices (subscription_id,user_id,amount,status,due_date,paid_at,description,mp_payment_id) VALUES
    (v_sub,v_user,79.90,'paid',now()-interval '45 days',now()-interval '45 days','Mensalidade Premium - 1º mês','mp-'||substr(md5(random()::text),1,10)),
    (v_sub,v_user,79.90,'paid',now()-interval '15 days',now()-interval '15 days','Mensalidade Premium - 2º mês','mp-'||substr(md5(random()::text),1,10)),
    (v_sub,v_user,79.90,'pending',now()+interval '15 days',NULL,'Mensalidade Premium - 3º mês',NULL);

  INSERT INTO pingo_ticket_accounts (user_id,balance,status) VALUES (v_user,250,'active') ON CONFLICT DO NOTHING;
  SELECT id INTO v_acct FROM pingo_ticket_accounts WHERE user_id=v_user LIMIT 1;
  UPDATE pingo_ticket_accounts SET balance=250, status='active' WHERE id=v_acct;
  DELETE FROM pingo_ticket_transactions WHERE account_id=v_acct;
  INSERT INTO pingo_ticket_transactions (account_id,user_id,type,amount,merchant,category,description,balance_after,created_at) VALUES
    (v_acct,v_user,'credit',150,'Pingo Card','mensalidade','Crédito mensal Premium',150,now()-interval '45 days'),
    (v_acct,v_user,'debit', 45,'Drogasil','farmacia','Compra de medicamentos',105,now()-interval '40 days'),
    (v_acct,v_user,'credit',150,'Pingo Card','mensalidade','Crédito mensal Premium',255,now()-interval '15 days'),
    (v_acct,v_user,'debit',  5,'Padaria do Bairro','alimentacao','Café da manhã',250,now()-interval '3 days');

  INSERT INTO dependents (guardian_id,first_name,last_name,cpf,date_of_birth,relationship)
  SELECT v_user,x.fn,x.ln,x.cpf,x.dob::date,x.rel FROM (VALUES
    ('Maria','Lopes','111.222.333-44','2015-04-12','filha'),
    ('Pedro','Lopes','222.333.444-55','2018-09-25','filho')) x(fn,ln,cpf,dob,rel)
  WHERE NOT EXISTS (SELECT 1 FROM dependents d WHERE d.guardian_id=v_user AND d.first_name=x.fn);
END $seed$;

INSERT INTO faq_items (question,answer,category,display_order,is_active) VALUES
('Como funciona a consulta por telemedicina?','Após o agendamento e pagamento você recebe o link da sala virtual e acessa pelo celular ou computador.','consulta',1,true),
('Posso emitir atestado médico?','Sim! Atestados são emitidos digitalmente com assinatura ICP-Brasil e validade jurídica.','documentos',2,true),
('Quais formas de pagamento aceitas?','Cartão de crédito, PIX e débito recorrente via Mercado Pago.','pagamento',3,true),
('A receita é válida em farmácias?','Sim, todas seguem padrão CFM com QR Code de validação.','documentos',4,true),
('Como cancelar uma consulta?','Pelo painel até 1h antes do horário, com reembolso integral.','consulta',5,true),
('O Cartão Pingo dá direito a desconto?','Sim, até 30% em consultas, exames e em farmácias parceiras.','cartao',6,true)
ON CONFLICT DO NOTHING;

INSERT INTO testimonials (name,role,content,avatar_url,rating,is_active,display_order) VALUES
('Mariana Souza','Paciente - SP','Atendimento rápido, médico atencioso, receita em minutos. Recomendo!','https://i.pravatar.cc/120?img=5',5,true,1),
('João Pereira','Paciente - RJ','Cancelei plano caro e migrei pra Aloclínica. Economizo R$ 400/mês.','https://i.pravatar.cc/120?img=15',5,true,2),
('Beatriz Costa','Mãe de paciente - MG','Consultei minha filha de madrugada quando ela teve febre. Salvou a noite.','https://i.pravatar.cc/120?img=25',5,true,3),
('Ricardo Almeida','Paciente - PR','3 consultas e atestado, tudo digital. Cartão Pingo vale muito a pena.','https://i.pravatar.cc/120?img=35',4,true,4)
ON CONFLICT DO NOTHING;

INSERT INTO sweepstakes (title,description,prize_value,prize_description,draw_date,ticket_generation_start,ticket_generation_end,status,authorization_code) VALUES
('Sorteio Aloclínica Junho/2026','Concorra a um iPhone 16. 1 número por assinatura ativa.',8500,'iPhone 16 128GB',
 (CURRENT_DATE+INTERVAL '40 days')::date,(CURRENT_DATE-INTERVAL '20 days')::date,(CURRENT_DATE+INTERVAL '35 days')::date,
 'open','SUSEP-2026-001234') ON CONFLICT DO NOTHING;

INSERT INTO sweepstake_tickets (sweepstake_id,user_id,ticket_number,source)
SELECT s.id,'77c528d4-c8b4-4e7f-8678-dabef20b5a44',lpad((floor(random()*999999))::text,6,'0'),'monthly'
FROM sweepstakes s WHERE s.status='open'
  AND EXISTS (SELECT 1 FROM auth.users WHERE id='77c528d4-c8b4-4e7f-8678-dabef20b5a44')
  AND NOT EXISTS (SELECT 1 FROM sweepstake_tickets st WHERE st.sweepstake_id=s.id AND st.user_id='77c528d4-c8b4-4e7f-8678-dabef20b5a44')
LIMIT 1;

UPDATE pingo_card_plans SET pingo_ticket_monthly_credit=0,   cta_label='Começar com Essencial' WHERE slug='essencial';
UPDATE pingo_card_plans SET pingo_ticket_monthly_credit=75,  cta_label='Assinar Família',  is_highlighted=true WHERE slug='familia';
UPDATE pingo_card_plans SET pingo_ticket_monthly_credit=150, cta_label='Assinar Premium' WHERE slug='premium';
