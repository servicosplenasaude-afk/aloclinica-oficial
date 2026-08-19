
-- 1) Notifications: aliases message/link
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

CREATE OR REPLACE FUNCTION public.fn_notifications_sync_legacy()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- legacy -> canonical
  IF NEW.body IS NULL AND NEW.message IS NOT NULL THEN NEW.body := NEW.message; END IF;
  IF NEW.action_url IS NULL AND NEW.link IS NOT NULL THEN NEW.action_url := NEW.link; END IF;
  -- canonical -> legacy (keep both filled for old readers)
  IF NEW.message IS NULL AND NEW.body IS NOT NULL THEN NEW.message := NEW.body; END IF;
  IF NEW.link IS NULL AND NEW.action_url IS NOT NULL THEN NEW.link := NEW.action_url; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notifications_sync_legacy ON public.notifications;
CREATE TRIGGER trg_notifications_sync_legacy
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.fn_notifications_sync_legacy();

UPDATE public.notifications SET message = COALESCE(message, body), link = COALESCE(link, action_url);

-- 2) faq_items: alias order_index
ALTER TABLE public.faq_items ADD COLUMN IF NOT EXISTS order_index INT;
ALTER TABLE public.faq_items ADD COLUMN IF NOT EXISTS display_order INT;

CREATE OR REPLACE FUNCTION public.fn_faq_sync_order()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_order IS NULL AND NEW.order_index IS NOT NULL THEN NEW.display_order := NEW.order_index; END IF;
  IF NEW.order_index IS NULL AND NEW.display_order IS NOT NULL THEN NEW.order_index := NEW.display_order; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_faq_sync_order ON public.faq_items;
CREATE TRIGGER trg_faq_sync_order
BEFORE INSERT OR UPDATE ON public.faq_items
FOR EACH ROW EXECUTE FUNCTION public.fn_faq_sync_order();

UPDATE public.faq_items SET order_index = COALESCE(order_index, display_order, 0);

-- 3) testimonials: alias order_index + text
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS order_index INT;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS display_order INT;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS content TEXT;

CREATE OR REPLACE FUNCTION public.fn_testimonials_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_order IS NULL AND NEW.order_index IS NOT NULL THEN NEW.display_order := NEW.order_index; END IF;
  IF NEW.order_index IS NULL AND NEW.display_order IS NOT NULL THEN NEW.order_index := NEW.display_order; END IF;
  IF NEW.content IS NULL AND NEW.text IS NOT NULL THEN NEW.content := NEW.text; END IF;
  IF NEW.text IS NULL AND NEW.content IS NOT NULL THEN NEW.text := NEW.content; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_testimonials_sync ON public.testimonials;
CREATE TRIGGER trg_testimonials_sync
BEFORE INSERT OR UPDATE ON public.testimonials
FOR EACH ROW EXECUTE FUNCTION public.fn_testimonials_sync();

UPDATE public.testimonials SET order_index = COALESCE(order_index, display_order, 0), text = COALESCE(text, content);

-- 4) appointments: adicionar cancel_reason
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 5) enum appointment_status: adicionar 'confirmed' se ausente
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='appointment_status')
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace
       WHERE n.nspname='public' AND t.typname='appointment_status' AND e.enumlabel='confirmed'
     ) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'confirmed';
  END IF;
END $$;

-- 6) expire_subscriptions_and_cards: remover referência a discount_cards
CREATE OR REPLACE FUNCTION public.expire_subscriptions_and_cards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now();
END;
$function$;
