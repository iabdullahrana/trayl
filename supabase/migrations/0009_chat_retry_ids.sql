BEGIN;
-- Client-generated IDs make retries safe after a lost response. RLS still
-- requires the authenticated sender and an accepted participant relationship.
GRANT INSERT (id) ON public.messages TO authenticated;
COMMIT;
