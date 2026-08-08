CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  status text NOT NULL CHECK (status IN ('present','absent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, day)
);
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  order_details text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  price_paid numeric(12,2) NOT NULL DEFAULT 0,
  price_left numeric(12,2) GENERATED ALWAYS AS (price - price_paid) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

INSERT INTO public.workers (id, name, code, is_admin) VALUES
  ('11111111-1111-1111-1111-111111111111','Admin','ADMIN2024', true),
  ('22222222-2222-2222-2222-222222222222','Ravi Kumar','RAVI01', false),
  ('33333333-3333-3333-3333-333333333333','Sana Sheikh','SANA02', false),
  ('44444444-4444-4444-4444-444444444444','Deepak Verma','DEEP03', false);

INSERT INTO public.attendance (worker_id, day, status) VALUES
  ('22222222-2222-2222-2222-222222222222', current_date - 1, 'present'),
  ('22222222-2222-2222-2222-222222222222', current_date - 2, 'present'),
  ('22222222-2222-2222-2222-222222222222', current_date - 3, 'absent'),
  ('33333333-3333-3333-3333-333333333333', current_date - 1, 'present'),
  ('33333333-3333-3333-3333-333333333333', current_date - 2, 'absent'),
  ('44444444-4444-4444-4444-444444444444', current_date - 1, 'present'),
  ('44444444-4444-4444-4444-444444444444', current_date - 2, 'present');

INSERT INTO public.orders (worker_id, customer_name, order_details, price, price_paid) VALUES
  ('22222222-2222-2222-2222-222222222222','Meena Traders','20 cartons of packaging tape', 12000, 8000),
  ('22222222-2222-2222-2222-222222222222','Sharma Store','5 display racks', 25000, 25000),
  ('33333333-3333-3333-3333-333333333333','Gupta Enterprises','100 printed boxes', 8500, 3000),
  ('44444444-4444-4444-4444-444444444444','City Mart','Monthly supply refill', 42000, 15000);