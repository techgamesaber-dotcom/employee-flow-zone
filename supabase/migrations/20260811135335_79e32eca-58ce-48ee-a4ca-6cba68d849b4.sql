CREATE TABLE IF NOT EXISTS public.canvas_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  space_key text NOT NULL,
  type text NOT NULL,
  x numeric NOT NULL DEFAULT 40,
  y numeric NOT NULL DEFAULT 40,
  w numeric NOT NULL DEFAULT 320,
  h numeric NOT NULL DEFAULT 180,
  z integer NOT NULL DEFAULT 1,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.canvas_elements TO service_role;
ALTER TABLE public.canvas_elements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS canvas_elements_company_space_idx ON public.canvas_elements (company_id, space_key);

CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  type text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer_key jsonb NOT NULL DEFAULT '{}'::jsonb,
  marks integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS exam_questions_exam_idx ON public.exam_questions (exam_id, position);

CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_score numeric NOT NULL DEFAULT 0,
  manual_score numeric NOT NULL DEFAULT 0,
  total_score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz,
  UNIQUE (exam_id, worker_id)
);
GRANT ALL ON public.exam_submissions TO service_role;
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;