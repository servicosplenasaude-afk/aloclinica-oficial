-- Expose only the small, explicitly public subset needed before authentication.

CREATE OR REPLACE FUNCTION public.get_public_announcement()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::jsonb FROM public.app_settings WHERE key = 'global_announcement' LIMIT 1),
    '{"active": false, "message": ""}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_announcement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_announcement() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_faq_items(p_limit integer DEFAULT 5)
RETURNS TABLE(question text, answer text, category text, order_index integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.question, f.answer, f.category, f.order_index
  FROM public.faq_items f
  WHERE f.is_active = true
  ORDER BY f.order_index
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.get_public_faq_items(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_faq_items(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_blocks()
RETURNS TABLE(page_slug text, block_key text, is_enabled boolean, published jsonb, i18n jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.page_slug, b.block_key, b.is_enabled,
         CASE WHEN b.is_enabled THEN b.published ELSE '{}'::jsonb END,
         CASE WHEN b.is_enabled THEN b.i18n ELSE '{}'::jsonb END
  FROM public.site_blocks b
  WHERE b.scope IN ('section', 'page', 'config', 'theme')
  ORDER BY b.display_order, b.block_key;
$$;

REVOKE ALL ON FUNCTION public.get_public_blocks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_blocks() TO anon, authenticated;
