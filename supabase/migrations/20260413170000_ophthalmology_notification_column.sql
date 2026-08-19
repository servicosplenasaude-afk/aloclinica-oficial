-- Add notification tracking to prescriptions
ALTER TABLE public.ophthalmology_prescriptions
ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_ophthalmology_prescriptions_notified
ON public.ophthalmology_prescriptions(notified, expiry_date);
