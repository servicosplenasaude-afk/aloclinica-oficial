
DO $$
DECLARE
  docs jsonb := '[
    {"first":"Ana","last":"Ribeiro","display":"Dra. Ana Ribeiro","price":159,"dur":30,"specs":["Cardiologia"],"photo":"https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop","bio":"Cardiologista com 12 anos de experiência em atendimento clínico e prevenção."},
    {"first":"Bruno","last":"Andrade","display":"Dr. Bruno Andrade","price":129,"dur":30,"specs":["Clínica Geral"],"photo":"https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop","bio":"Clínico geral focado em atendimento humanizado e medicina preventiva."},
    {"first":"Camila","last":"Souza","display":"Dra. Camila Souza","price":189,"dur":40,"specs":["Pediatria"],"photo":"https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop","bio":"Pediatra com especialização em desenvolvimento infantil e adolescente."},
    {"first":"Diego","last":"Martins","display":"Dr. Diego Martins","price":169,"dur":30,"specs":["Dermatologia"],"photo":"https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop","bio":"Dermatologista clínico, especialista em acne, alergias e teledermatologia."},
    {"first":"Eduarda","last":"Lima","display":"Dra. Eduarda Lima","price":219,"dur":50,"specs":["Psiquiatria","Psicologia"],"photo":"https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=400&h=400&fit=crop","bio":"Psiquiatra com foco em ansiedade, depressão e transtornos do humor."},
    {"first":"Felipe","last":"Costa","display":"Dr. Felipe Costa","price":149,"dur":30,"specs":["Ortopedia"],"photo":"https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop","bio":"Ortopedista — orientação para dores articulares, lesões e reabilitação."},
    {"first":"Giovana","last":"Pereira","display":"Dra. Giovana Pereira","price":179,"dur":40,"specs":["Ginecologia"],"photo":"https://images.unsplash.com/photo-1551601651-bc60f254d532?w=400&h=400&fit=crop","bio":"Ginecologista, saúde da mulher e acompanhamento hormonal."},
    {"first":"Henrique","last":"Almeida","display":"Dr. Henrique Almeida","price":199,"dur":40,"specs":["Endocrinologia"],"photo":"https://images.unsplash.com/photo-1612531386530-97286d97c2d2?w=400&h=400&fit=crop","bio":"Endocrinologista — diabetes, tireoide e obesidade."}
  ]'::jsonb;
  d jsonb;
  v_user_id uuid;
  v_doctor_id uuid;
  v_spec_id uuid;
  v_spec_name text;
  v_slug text;
  v_email text;
  v_day int;
  v_idx int := 0;
BEGIN
  FOR d IN SELECT * FROM jsonb_array_elements(docs) LOOP
    v_idx := v_idx + 1;
    v_user_id := gen_random_uuid();
    v_doctor_id := gen_random_uuid();
    v_email := 'seed-doctor-' || v_idx || '-' || substr(v_user_id::text, 1, 8) || '@test.alomedico.local';
    v_slug := lower(regexp_replace((d->>'display'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(v_doctor_id::text, 1, 8);

    -- Cria auth user mínimo (seed de teste)
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, is_anonymous
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, extensions.crypt('SeedDoctor!2026', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('first_name', d->>'first', 'last_name', d->>'last', 'seed', true),
      false, false
    );

    INSERT INTO public.profiles (user_id, first_name, last_name, gender, account_status, avatar_url)
    VALUES (v_user_id, d->>'first', d->>'last', 'other', 'active', d->>'photo')
    ON CONFLICT (user_id) DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, avatar_url=EXCLUDED.avatar_url;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'doctor') ON CONFLICT DO NOTHING;

    INSERT INTO public.doctor_profiles (
      id, user_id, display_name, bio, price, return_price, consultation_duration,
      is_approved, is_active, doctor_type, kyc_status, kyc_verified_at,
      crm, crm_state, crm_verified, crm_verified_at,
      professional_photo_url, slug, rating_avg, rating_count
    )
    VALUES (
      v_doctor_id, v_user_id, d->>'display', d->>'bio',
      (d->>'price')::numeric, ((d->>'price')::numeric * 0.7), (d->>'dur')::int,
      true, true, 'telemedicina', 'approved', now(),
      'CRM' || (100000 + floor(random()*899999)::int)::text, 'SP', true, now(),
      d->>'photo', v_slug, round((4.5 + random()*0.5)::numeric, 2), 10 + floor(random()*200)::int
    );

    FOR v_spec_name IN SELECT jsonb_array_elements_text(d->'specs') LOOP
      SELECT id INTO v_spec_id FROM public.specialties WHERE name = v_spec_name LIMIT 1;
      IF v_spec_id IS NOT NULL THEN
        INSERT INTO public.doctor_specialties (doctor_id, specialty_id)
        VALUES (v_doctor_id, v_spec_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    FOR v_day IN 1..5 LOOP
      INSERT INTO public.availability_slots (doctor_id, day_of_week, start_time, end_time, is_active)
      VALUES
        (v_doctor_id, v_day, '08:00', '12:00', true),
        (v_doctor_id, v_day, '14:00', '18:00', true);
    END LOOP;
  END LOOP;
END $$;
