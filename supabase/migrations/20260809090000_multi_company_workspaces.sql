CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  emoji text NOT NULL,
  tagline text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.worker_companies (
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_id, company_id),
  UNIQUE (company_id, access_code)
);
GRANT ALL ON public.worker_companies TO service_role;
ALTER TABLE public.worker_companies ENABLE ROW LEVEL SECURITY;

INSERT INTO public.companies (slug, name, emoji, tagline) VALUES
  ('section-a-origami', 'Section A Origami', '🟨', 'Fold ideas into something amazing'),
  ('world-of-tech', 'World of Tech', '💻', 'Build apps. Ship ideas. Make things happen.'),
  ('world-of-designing', 'World of Designing', '🏠', 'Design spaces and plan companies.'),
  ('world-of-colours', 'World of Colours', '🎨', 'Create, sketch, paint and imagine.');

INSERT INTO public.worker_companies (worker_id, company_id)
SELECT w.id, c.id
FROM public.workers w
CROSS JOIN public.companies c
WHERE w.is_admin = true;

INSERT INTO public.worker_companies (worker_id, company_id)
SELECT w.id, c.id
FROM public.workers w
JOIN public.companies c ON c.slug = 'section-a-origami'
WHERE w.is_admin = false;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

UPDATE public.attendance a
SET company_id = wc.company_id
FROM public.worker_companies wc
WHERE wc.worker_id = a.worker_id
  AND wc.company_id = (SELECT id FROM public.companies WHERE slug = 'section-a-origami')
  AND a.company_id IS NULL;

UPDATE public.orders o
SET company_id = wc.company_id
FROM public.worker_companies wc
WHERE wc.worker_id = o.worker_id
  AND wc.company_id = (SELECT id FROM public.companies WHERE slug = 'section-a-origami')
  AND o.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_worker_companies_worker ON public.worker_companies(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_companies_company ON public.worker_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company ON public.attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company ON public.orders(company_id);

GRANT ALL ON public.worker_companies TO service_role;
