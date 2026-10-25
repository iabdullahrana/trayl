BEGIN;

CREATE UNIQUE INDEX requests_one_pending_per_sender_journey
ON public.requests (journey_id, sender_id) WHERE status = 'pending';

-- Keep journey context visible after completion, cancellation or departure.
CREATE POLICY journeys_select_own
ON public.journeys FOR SELECT TO authenticated
USING (traveller_id = (SELECT auth.uid()));

CREATE POLICY journeys_select_requested
ON public.journeys FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.requests AS r
    WHERE r.journey_id = journeys.id AND r.sender_id = (SELECT auth.uid())
));

-- The existing INSERT policy still requires status = 'pending'.
GRANT INSERT (status) ON public.requests TO authenticated;

COMMIT;
