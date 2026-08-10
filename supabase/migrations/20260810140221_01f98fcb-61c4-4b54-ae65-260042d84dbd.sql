CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '✨',
  tagline text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.worker_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, company_id)
);
GRANT ALL ON public.worker_companies TO service_role;
ALTER TABLE public.worker_companies ENABLE ROW LEVEL SECURITY;

INSERT INTO public.companies (slug, name, emoji, tagline) VALUES
  ('section-a-origami', 'Section A Origami', '🐦', 'Fold, create, deliver.'),
  ('world-of-tech', 'World of Tech', '💻', 'Build the next big thing.'),
  ('world-of-designing', 'World of Designing', '🛋️', 'Spaces that feel like home.'),
  ('world-of-colours', 'World of Colours', '🎨', 'Paint the day bright.')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.attendance SET company_id = (SELECT id FROM public.companies WHERE slug = 'section-a-origami') WHERE company_id IS NULL;
UPDATE public.orders SET company_id = (SELECT id FROM public.companies WHERE slug = 'section-a-origami') WHERE company_id IS NULL;

ALTER TABLE public.attendance ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN company_id SET NOT NULL;

INSERT INTO public.worker_companies (worker_id, company_id)
SELECT w.id, c.id FROM public.workers w CROSS JOIN public.companies c WHERE c.slug = 'section-a-origami'
ON CONFLICT DO NOTHING;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_worker_id_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_worker_company_day_key ON public.attendance (worker_id, company_id, day);