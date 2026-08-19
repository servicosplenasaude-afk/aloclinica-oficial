-- Add patient rating columns to appointments
alter table public.appointments
  add column if not exists patient_rating smallint check (patient_rating between 1 and 5),
  add column if not exists patient_review text,
  add column if not exists rated_at timestamptz;

-- Function to update doctor's rolling average rating
create or replace function public.update_doctor_rating(p_doctor_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_avg numeric;
  v_count integer;
begin
  select
    round(avg(a.patient_rating)::numeric, 1),
    count(*)
  into v_avg, v_count
  from public.appointments a
  where a.doctor_id = p_doctor_id
    and a.patient_rating is not null
    and a.status = 'completed';

  update public.doctor_profiles
  set
    rating       = coalesce(v_avg, rating),
    total_reviews = v_count,
    updated_at   = now()
  where id = p_doctor_id;
end;
$$;

-- Trigger to auto-update doctor rating whenever appointment.patient_rating is set
create or replace function public.trg_appointment_rating()
returns trigger
language plpgsql
security definer
as $$
begin
  if (new.patient_rating is not null and new.patient_rating is distinct from old.patient_rating) then
    perform public.update_doctor_rating(new.doctor_id);
  end if;
  return new;
end;
$$;

drop trigger if exists appointment_rating_trigger on public.appointments;
create trigger appointment_rating_trigger
  after update of patient_rating on public.appointments
  for each row execute function public.trg_appointment_rating();

-- RLS: only the patient who booked can rate their own appointment
drop policy if exists "patient can rate own appointment" on public.appointments;
create policy "patient can rate own appointment"
  on public.appointments
  for update
  to authenticated
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);
