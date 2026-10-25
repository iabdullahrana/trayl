BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE FUNCTION public.is_account_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_active); $$;

CREATE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin' AND is_active); $$;

REVOKE ALL ON FUNCTION public.is_account_active(), public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_active(), public.is_admin() TO authenticated;

-- Old JWTs must not allow deactivated accounts to keep accessing private data
-- or mutating rows directly through the API. These restrict all existing policies.
CREATE POLICY profiles_require_active ON public.profiles AS RESTRICTIVE
FOR ALL TO authenticated USING (public.is_account_active()) WITH CHECK (public.is_account_active());
CREATE POLICY journeys_require_active ON public.journeys AS RESTRICTIVE
FOR ALL TO authenticated USING (public.is_account_active()) WITH CHECK (public.is_account_active());
CREATE POLICY requests_require_active ON public.requests AS RESTRICTIVE
FOR ALL TO authenticated USING (public.is_account_active()) WITH CHECK (public.is_account_active());

-- Contact reveal is SECURITY DEFINER, so it needs its own active-account check.
CREATE OR REPLACE FUNCTION public.contact_reveal(journey_id uuid, other_user_id uuid)
RETURNS TABLE (phone text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT p.phone, p.email FROM public.profiles AS p
    WHERE public.is_account_active()
      AND p.id = $2 AND $2 <> (SELECT auth.uid())
      AND EXISTS (
          SELECT 1 FROM public.requests AS r
          JOIN public.journeys AS j ON j.id = r.journey_id
          WHERE r.journey_id = $1 AND r.status = 'accepted'
            AND ((r.sender_id = (SELECT auth.uid()) AND j.traveller_id = $2)
              OR (j.traveller_id = (SELECT auth.uid()) AND r.sender_id = $2))
      );
$$;

-- Fixed projections, filters and page size; no arbitrary SQL or private-table
-- grants. Authorization is checked inside every admin RPC as well as the app.
CREATE FUNCTION public.admin_list(entity text, status_filter text DEFAULT 'all', page_number integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    rows_json jsonb;
    total_rows bigint;
    row_offset integer;
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
    IF page_number IS NULL OR page_number < 1 OR page_number > 100000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
    row_offset := (page_number - 1) * 20;
    IF entity = 'users' THEN
        IF status_filter IS NULL OR status_filter NOT IN ('all', 'active', 'inactive') THEN RAISE EXCEPTION 'Invalid status'; END IF;
        SELECT count(*) INTO total_rows FROM public.profiles AS p
        WHERE status_filter = 'all' OR p.is_active = (status_filter = 'active');
        SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
            SELECT p.id, p.name, p.email, p.phone, p.created_at, p.is_active
            FROM public.profiles AS p WHERE status_filter = 'all' OR p.is_active = (status_filter = 'active')
            ORDER BY p.created_at DESC NULLS LAST, p.id LIMIT 20 OFFSET row_offset
        ) AS t;
    ELSIF entity = 'journeys' THEN
        IF status_filter IS NULL OR status_filter NOT IN ('all', 'active', 'completed', 'cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
        SELECT count(*) INTO total_rows FROM public.journeys AS j WHERE status_filter = 'all' OR j.status = status_filter;
        SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
            SELECT j.id, p.name AS traveller_name, j.from_city, j.to_city, j.travel_date, j.travel_time, j.status
            FROM public.journeys AS j JOIN public.profiles AS p ON p.id = j.traveller_id
            WHERE status_filter = 'all' OR j.status = status_filter
            ORDER BY j.created_at DESC NULLS LAST, j.id LIMIT 20 OFFSET row_offset
        ) AS t;
    ELSIF entity = 'requests' THEN
        IF status_filter IS NULL OR status_filter NOT IN ('all', 'pending', 'accepted', 'declined') THEN RAISE EXCEPTION 'Invalid status'; END IF;
        SELECT count(*) INTO total_rows FROM public.requests AS r WHERE status_filter = 'all' OR r.status = status_filter;
        SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
            SELECT r.id, s.name AS sender_name, p.name AS traveller_name, j.from_city, j.to_city, r.status, r.created_at
            FROM public.requests AS r JOIN public.journeys AS j ON j.id = r.journey_id
            JOIN public.profiles AS s ON s.id = r.sender_id JOIN public.profiles AS p ON p.id = j.traveller_id
            WHERE status_filter = 'all' OR r.status = status_filter
            ORDER BY r.created_at DESC NULLS LAST, r.id LIMIT 20 OFFSET row_offset
        ) AS t;
    ELSE RAISE EXCEPTION 'Invalid entity';
    END IF;
    RETURN jsonb_build_object('rows', rows_json, 'total', total_rows);
END;
$$;

CREATE FUNCTION public.admin_deactivate_user(target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
    IF target_user_id = (SELECT auth.uid()) THEN RAISE EXCEPTION 'Cannot deactivate your own account'; END IF;
    UPDATE public.profiles SET is_active = false WHERE id = target_user_id AND is_active;
    RETURN FOUND;
END;
$$;

CREATE FUNCTION public.admin_force_cancel_journey(target_journey_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
    UPDATE public.journeys SET status = 'cancelled' WHERE id = target_journey_id AND status <> 'cancelled';
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list(text, text, integer), public.admin_deactivate_user(uuid), public.admin_force_cancel_journey(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list(text, text, integer), public.admin_deactivate_user(uuid), public.admin_force_cancel_journey(uuid) TO authenticated;

-- Do not grant profile is_active/role updates to browser clients.
COMMIT;
