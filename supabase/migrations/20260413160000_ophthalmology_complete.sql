-- Ophthalmology module: exams, prescriptions, results

-- Eye exams table
CREATE TABLE IF NOT EXISTS public.ophthalmology_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Refraction (left & right eye)
  od_sphere DECIMAL(5,2),    -- OD (oculus dexter) = right eye
  od_cylinder DECIMAL(5,2),
  od_axis INTEGER,
  os_sphere DECIMAL(5,2),    -- OS (oculus sinister) = left eye
  os_cylinder DECIMAL(5,2),
  os_axis INTEGER,

  -- Visual acuity
  va_od TEXT,  -- e.g., "20/20", "6/6"
  va_os TEXT,
  va_ou TEXT,  -- OU (both eyes)

  -- Tonometry (eye pressure)
  intraocular_pressure_od DECIMAL(5,2),
  intraocular_pressure_os DECIMAL(5,2),
  tonometry_method TEXT,  -- Goldmann, Tonopen, etc.

  -- Other findings
  anterior_segment TEXT,
  posterior_segment TEXT,
  pupil_reaction TEXT,
  color_blindness_test TEXT,
  other_findings TEXT,

  exam_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Earlier installations already have the technician-oriented version of this
-- table. CREATE TABLE IF NOT EXISTS does not merge schemas, so add the bridge
-- columns needed by the policies below without destroying existing exam data.
ALTER TABLE public.ophthalmology_exams
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ophthalmology_exams_patient ON public.ophthalmology_exams(patient_id);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_exams_doctor ON public.ophthalmology_exams(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_exams_appointment ON public.ophthalmology_exams(appointment_id);

-- Glasses/Contact lens prescription
CREATE TABLE IF NOT EXISTS public.ophthalmology_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.ophthalmology_exams(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type
  prescription_type TEXT NOT NULL CHECK (prescription_type IN ('glasses', 'contact_lens', 'both')),

  -- Right eye (OD)
  od_sphere DECIMAL(5,2),
  od_cylinder DECIMAL(5,2),
  od_axis INTEGER,
  od_add DECIMAL(5,2),  -- Addition for progressive lenses
  od_prism DECIMAL(5,2),
  od_base TEXT,  -- Base direction (BI, BO, BU, BD)

  -- Left eye (OS)
  os_sphere DECIMAL(5,2),
  os_cylinder DECIMAL(5,2),
  os_axis INTEGER,
  os_add DECIMAL(5,2),
  os_prism DECIMAL(5,2),
  os_base TEXT,

  -- Contact lens specific
  contact_lens_type TEXT,  -- Soft, rigid, etc.
  contact_lens_brand TEXT,
  contact_lens_base_curve DECIMAL(5,2),
  contact_lens_diameter DECIMAL(5,2),

  -- General prescription info
  pupillary_distance DECIMAL(5,2),  -- PD in mm
  recommended_use TEXT,  -- For distance, reading, computer, etc.
  expiry_date DATE,
  observations TEXT,

  prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ophthalmology_prescriptions
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS prescription_type TEXT;

CREATE INDEX IF NOT EXISTS idx_ophthalmology_prescriptions_patient ON public.ophthalmology_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_prescriptions_exam ON public.ophthalmology_prescriptions(exam_id);
CREATE INDEX IF NOT EXISTS idx_ophthalmology_prescriptions_doctor ON public.ophthalmology_prescriptions(doctor_id);

-- Prescription PDF/document storage
CREATE TABLE IF NOT EXISTS public.ophthalmology_prescription_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.ophthalmology_prescriptions(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type TEXT,  -- PDF format details
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_documents ON public.ophthalmology_prescription_documents(prescription_id);

-- RLS policies
ALTER TABLE public.ophthalmology_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ophthalmology_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ophthalmology_prescription_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_doctor_read" ON public.ophthalmology_exams
  FOR SELECT USING (auth.uid() = doctor_id OR auth.uid() = patient_id);

CREATE POLICY "exams_doctor_write" ON public.ophthalmology_exams
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "exams_doctor_update" ON public.ophthalmology_exams
  FOR UPDATE USING (auth.uid() = doctor_id);

CREATE POLICY "prescriptions_patient_read" ON public.ophthalmology_prescriptions
  FOR SELECT USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

CREATE POLICY "prescriptions_doctor_write" ON public.ophthalmology_prescriptions
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "prescriptions_doctor_update" ON public.ophthalmology_prescriptions
  FOR UPDATE USING (auth.uid() = doctor_id);

CREATE POLICY "prescription_docs_read" ON public.ophthalmology_prescription_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ophthalmology_prescriptions p
            WHERE p.id = ophthalmology_prescription_documents.prescription_id
            AND (p.patient_id = auth.uid() OR p.doctor_id = auth.uid()))
  );
