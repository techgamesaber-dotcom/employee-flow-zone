ALTER TABLE public.workspace_items ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.mcq_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcq_exams_company_idx ON public.mcq_exams(company_id);
GRANT ALL ON public.mcq_exams TO service_role;
ALTER TABLE public.mcq_exams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.worker_points (
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_points integer NOT NULL DEFAULT 0,
  exam_points integer NOT NULL DEFAULT 0,
  PRIMARY KEY (worker_id, company_id)
);
GRANT ALL ON public.worker_points TO service_role;
ALTER TABLE public.worker_points ENABLE ROW LEVEL SECURITY;
