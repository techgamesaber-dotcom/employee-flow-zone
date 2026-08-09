ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_worker_id_day_key;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_worker_company_day_key UNIQUE (worker_id, company_id, day);
