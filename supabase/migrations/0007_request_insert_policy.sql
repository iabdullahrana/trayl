BEGIN;

-- The request INSERT policy previously selected journeys through journey RLS,
-- whose journeys_select_requested policy selected requests again (42P17).
-- This helper checks only the target journey and current caller, bypassing that
-- policy cycle without granting access to journey rows or profile contacts.
CREATE FUNCTION public.can_request_journey(journey_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT public.is_account_active() AND EXISTS (
        SELECT 1 FROM public.journeys AS j
        WHERE j.id = $1
          AND j.traveller_id <> (SELECT auth.uid())
          AND j.status = 'active'
          AND (j.travel_date + j.travel_time) AT TIME ZONE 'UTC' >= now()
    );
$$;

REVOKE ALL ON FUNCTION public.can_request_journey(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_request_journey(uuid) TO authenticated;

DROP POLICY requests_insert_sender ON public.requests;
CREATE POLICY requests_insert_sender ON public.requests
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND status = 'pending'
    AND public.can_request_journey(journey_id)
);

COMMIT;
