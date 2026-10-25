BEGIN;
-- Admin-only filters apply before both counts and 20-row pagination.
CREATE FUNCTION public.admin_list_filtered(entity text, status_filter text DEFAULT 'all', page_number integer DEFAULT 1, date_from date DEFAULT NULL, date_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    rows_json jsonb;
    total_rows bigint;
    row_offset integer;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
    IF page_number IS NULL OR page_number < 1 OR page_number > 100000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
    IF date_from > date_to THEN RAISE EXCEPTION 'Start date must not follow end date'; END IF;
    row_offset := (page_number - 1) * 20;
    IF entity = 'users' THEN
        IF status_filter IS NULL OR status_filter NOT IN ('all', 'active', 'inactive') THEN RAISE EXCEPTION 'Invalid status'; END IF;
        SELECT count(*) INTO total_rows FROM public.profiles AS p
        WHERE (status_filter = 'all' OR p.is_active = (status_filter = 'active')) AND (date_from IS NULL OR (p.created_at AT TIME ZONE 'UTC')::date >= date_from) AND (date_to IS NULL OR (p.created_at AT TIME ZONE 'UTC')::date <= date_to);
        SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
            SELECT p.id, p.name, p.email, p.phone, p.created_at, p.is_active
            FROM public.profiles AS p WHERE (status_filter = 'all' OR p.is_active = (status_filter = 'active')) AND (date_from IS NULL OR (p.created_at AT TIME ZONE 'UTC')::date >= date_from) AND (date_to IS NULL OR (p.created_at AT TIME ZONE 'UTC')::date <= date_to)
            ORDER BY p.created_at DESC NULLS LAST, p.id LIMIT 20 OFFSET row_offset
        ) AS t;
    ELSIF entity = 'journeys' THEN
        IF status_filter IS NULL OR status_filter NOT IN ('all', 'active', 'completed', 'cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
        SELECT count(*) INTO total_rows FROM public.journeys AS j WHERE (status_filter = 'all' OR j.status = status_filter) AND (date_from IS NULL OR j.travel_date >= date_from) AND (date_to IS NULL OR j.travel_date <= date_to);
        SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
            SELECT j.id, p.name AS traveller_name, j.from_city, j.to_city, j.travel_date, j.travel_time, j.status
            FROM public.journeys AS j JOIN public.profiles AS p ON p.id = j.traveller_id
            WHERE (status_filter = 'all' OR j.status = status_filter) AND (date_from IS NULL OR j.travel_date >= date_from) AND (date_to IS NULL OR j.travel_date <= date_to)
            ORDER BY j.created_at DESC NULLS LAST, j.id LIMIT 20 OFFSET row_offset
        ) AS t;
    ELSIF entity = 'requests' THEN
        IF status_filter IS NULL OR status_filter NOT IN ('all', 'pending', 'accepted', 'declined') THEN RAISE EXCEPTION 'Invalid status'; END IF;
        SELECT count(*) INTO total_rows FROM public.requests AS r WHERE (status_filter = 'all' OR r.status = status_filter) AND (date_from IS NULL OR (r.created_at AT TIME ZONE 'UTC')::date >= date_from) AND (date_to IS NULL OR (r.created_at AT TIME ZONE 'UTC')::date <= date_to);
        SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
            SELECT r.id, s.name AS sender_name, p.name AS traveller_name, j.from_city, j.to_city, r.status, r.created_at
            FROM public.requests AS r JOIN public.journeys AS j ON j.id = r.journey_id
            JOIN public.profiles AS s ON s.id = r.sender_id JOIN public.profiles AS p ON p.id = j.traveller_id
            WHERE (status_filter = 'all' OR r.status = status_filter) AND (date_from IS NULL OR (r.created_at AT TIME ZONE 'UTC')::date >= date_from) AND (date_to IS NULL OR (r.created_at AT TIME ZONE 'UTC')::date <= date_to)
            ORDER BY r.created_at DESC NULLS LAST, r.id LIMIT 20 OFFSET row_offset
        ) AS t;
    ELSE RAISE EXCEPTION 'Invalid entity';
    END IF;
    RETURN jsonb_build_object('rows', rows_json, 'total', total_rows);
END;
$$;

CREATE FUNCTION public.admin_reports_filtered(status_filter text DEFAULT 'all', page_number integer DEFAULT 1, date_from date DEFAULT NULL, date_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE rows_json jsonb; total_rows bigint;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF status_filter IS NULL OR status_filter NOT IN ('all','open','reviewed') OR page_number IS NULL OR page_number NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Invalid filters'; END IF;
  IF date_from > date_to THEN RAISE EXCEPTION 'Start date must not follow end date'; END IF;
  SELECT count(*) INTO total_rows FROM public.message_reports WHERE (status_filter = 'all' OR status = status_filter) AND (date_from IS NULL OR (created_at AT TIME ZONE 'UTC')::date >= date_from) AND (date_to IS NULL OR (created_at AT TIME ZONE 'UTC')::date <= date_to);
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
    SELECT r.id, r.request_id, r.message_id, r.reason, r.status, r.created_at,
      p.name AS reporter_name, reported.name AS reported_name, reported.id AS reported_user_id, reported.is_active AS reported_is_active
    FROM public.message_reports r JOIN public.profiles p ON p.id = r.reporter_id
    JOIN public.requests q ON q.id = r.request_id JOIN public.journeys j ON j.id = q.journey_id
    LEFT JOIN public.messages m ON m.id = r.message_id
    JOIN public.profiles reported ON reported.id = coalesce(m.sender_id, CASE WHEN q.sender_id = r.reporter_id THEN j.traveller_id ELSE q.sender_id END)
    WHERE (status_filter = 'all' OR r.status = status_filter) AND (date_from IS NULL OR (r.created_at AT TIME ZONE 'UTC')::date >= date_from) AND (date_to IS NULL OR (r.created_at AT TIME ZONE 'UTC')::date <= date_to)
    ORDER BY r.created_at DESC, r.id LIMIT 20 OFFSET (page_number - 1) * 20
  ) t;
  RETURN jsonb_build_object('rows', rows_json, 'total', total_rows);
END $$;


REVOKE ALL ON FUNCTION public.admin_list_filtered(text,text,integer,date,date), public.admin_reports_filtered(text,integer,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_filtered(text,text,integer,date,date), public.admin_reports_filtered(text,integer,date,date) TO authenticated;
COMMIT;
