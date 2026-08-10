CREATE TABLE IF NOT EXISTS public.workspace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  space_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_items_company_space_idx ON public.workspace_items(company_id, space_key);
GRANT ALL ON public.workspace_items TO service_role;
ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;

INSERT INTO public.workspace_items (company_id, space_key, title, description)
SELECT c.id, s.space_key, s.title, s.description
FROM public.companies c
CROSS JOIN (VALUES
  ('space-1','Library','Browse your company resources and saved ideas.'),
  ('space-2','Studio','Open the creative workspace for this area.'),
  ('space-3','Projects','Keep track of active work and project ideas.'),
  ('space-4','Challenges','Practice, experiment and complete team challenges.'),
  ('space-5','Gallery','View work, examples and completed creations.'),
  ('space-6','Requests','See useful requests, notes and custom tasks.')
) AS s(space_key,title,description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_items wi WHERE wi.company_id = c.id AND wi.space_key = s.space_key
);
