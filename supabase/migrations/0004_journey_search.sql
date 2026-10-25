BEGIN;

-- Guests may search upcoming journeys, but receive only public journey fields
-- and the traveller's name. Direct table/contact permissions stay unchanged.
CREATE FUNCTION public.search_journeys(search_from text, search_to text, search_date date)
RETURNS TABLE (
    id uuid, traveller_id uuid, traveller_name text, from_city text, to_city text,
    travel_date date, travel_time time, item_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT j.id, j.traveller_id, p.name, j.from_city, j.to_city,
           j.travel_date, j.travel_time, j.item_type
    FROM public.journeys AS j
    JOIN public.profiles AS p ON p.id = j.traveller_id
    WHERE j.status = 'active'
      AND length(search_from) <= 100 AND length(search_to) <= 100
      AND j.from_city ILIKE '%' || replace(replace(replace(search_from, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
      AND j.to_city ILIKE '%' || replace(replace(replace(search_to, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
      AND j.travel_date = search_date
      AND j.travel_date + j.travel_time >= timezone('UTC', statement_timestamp())
    ORDER BY j.travel_time ASC, j.id ASC;
$$;

REVOKE ALL ON FUNCTION public.search_journeys(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_journeys(text, text, date) TO anon, authenticated;

COMMIT;
