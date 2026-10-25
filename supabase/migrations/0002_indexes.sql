-- supabase/migrations/0002_indexes.sql

BEGIN;

CREATE INDEX journeys_route_schedule_idx
ON public.journeys (from_city, to_city, travel_date, travel_time);

CREATE INDEX requests_journey_id_idx
ON public.requests (journey_id);

CREATE INDEX requests_sender_id_idx
ON public.requests (sender_id);

COMMIT;
