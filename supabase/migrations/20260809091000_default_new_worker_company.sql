CREATE OR REPLACE FUNCTION public.assign_new_worker_to_origami()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.worker_companies (worker_id, company_id)
  SELECT NEW.id, id FROM public.companies WHERE slug = 'section-a-origami'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_new_worker_to_origami ON public.workers;
CREATE TRIGGER trg_assign_new_worker_to_origami
AFTER INSERT ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.assign_new_worker_to_origami();
