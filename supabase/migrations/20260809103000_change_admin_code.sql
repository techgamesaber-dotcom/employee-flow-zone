-- Change the seeded administrator login code to the owner's requested code.
UPDATE public.workers
SET code = 'RAG12'
WHERE is_admin = true AND code = 'ADMIN2024';
