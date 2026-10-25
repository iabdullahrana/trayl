-- supabase/migrations/0001_init.sql

BEGIN;

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    name text NOT NULL,
    phone text,
    email text,
    is_adult_confirmed boolean NOT NULL DEFAULT false,
    role text NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.journeys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    traveller_id uuid NOT NULL REFERENCES public.profiles(id),
    from_city text NOT NULL,
    to_city text NOT NULL,
    travel_date date NOT NULL,
    travel_time time NOT NULL,
    item_type text NOT NULL
        CHECK (item_type IN ('document', 'package')),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id uuid NOT NULL REFERENCES public.journeys(id),
    sender_id uuid NOT NULL REFERENCES public.profiles(id),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Remove Supabase's default API grants before assigning precise privileges.
REVOKE ALL ON TABLE
    public.profiles,
    public.journeys,
    public.requests
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;

-- Role changes and profile provisioning belong to trusted server-side code.
GRANT UPDATE (name, phone, email, is_adult_confirmed)
ON public.profiles TO authenticated;

GRANT SELECT, DELETE ON public.journeys TO authenticated;

GRANT INSERT (
    traveller_id,
    from_city,
    to_city,
    travel_date,
    travel_time,
    item_type,
    status
) ON public.journeys TO authenticated;

GRANT UPDATE (
    from_city,
    to_city,
    travel_date,
    travel_time,
    item_type,
    status
) ON public.journeys TO authenticated;

GRANT SELECT ON public.requests TO authenticated;
GRANT INSERT (journey_id, sender_id)
ON public.requests TO authenticated;
GRANT UPDATE (status) ON public.requests TO authenticated;

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- RLS filters rows, not columns. Expose other users only through this
-- deliberately owner-executed view, which projects id/name exclusively.
CREATE VIEW public.profile_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT id, name
FROM public.profiles;

REVOKE ALL ON TABLE public.profile_directory
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.profile_directory TO authenticated;

-- This narrow helper checks ownership independently of journey visibility.
-- It lets travellers access requests even after a journey stops being public.
CREATE FUNCTION public.is_journey_owner(journey_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.journeys AS j
        WHERE j.id = $1
          AND j.traveller_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_journey_owner(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_journey_owner(uuid)
TO authenticated;

CREATE POLICY journeys_select_available
ON public.journeys
FOR SELECT TO authenticated
USING (
    status = 'active'
    AND travel_date >= CURRENT_DATE
);

CREATE POLICY journeys_insert_own
ON public.journeys
FOR INSERT TO authenticated
WITH CHECK (traveller_id = (SELECT auth.uid()));

CREATE POLICY journeys_update_own
ON public.journeys
FOR UPDATE TO authenticated
USING (traveller_id = (SELECT auth.uid()))
WITH CHECK (traveller_id = (SELECT auth.uid()));

CREATE POLICY journeys_delete_own
ON public.journeys
FOR DELETE TO authenticated
USING (traveller_id = (SELECT auth.uid()));

-- INSERT privileges exclude status, so new requests always start pending.
-- Journey RLS also restricts this check to active, upcoming journeys.
CREATE POLICY requests_insert_sender
ON public.requests
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.journeys AS j
        WHERE j.id = requests.journey_id
          AND j.traveller_id <> (SELECT auth.uid())
          AND j.status = 'active'
          AND j.travel_date >= CURRENT_DATE
    )
);

CREATE POLICY requests_select_participant
ON public.requests
FOR SELECT TO authenticated
USING (
    sender_id = (SELECT auth.uid())
    OR public.is_journey_owner(journey_id)
);

-- Column privileges prevent changing journey_id, sender_id, or timestamps.
CREATE POLICY requests_update_traveller
ON public.requests
FOR UPDATE TO authenticated
USING (public.is_journey_owner(journey_id))
WITH CHECK (
    public.is_journey_owner(journey_id)
    AND status IN ('accepted', 'declined')
);

CREATE FUNCTION public.set_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_request_updated_at()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER requests_set_updated_at
BEFORE UPDATE ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.set_request_updated_at();

-- Returns zero rows unless the caller and other_user_id are the sender
-- and traveller of an accepted request for precisely this journey.
-- SECURITY DEFINER intentionally bypasses profile/journey SELECT policies;
-- authorization is enforced explicitly inside the function.
CREATE FUNCTION public.contact_reveal(
    journey_id uuid,
    other_user_id uuid
)
RETURNS TABLE (
    phone text,
    email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.phone, p.email
    FROM public.profiles AS p
    WHERE p.id = $2
      AND (SELECT auth.uid()) IS NOT NULL
      AND $2 <> (SELECT auth.uid())
      AND EXISTS (
          SELECT 1
          FROM public.requests AS r
          JOIN public.journeys AS j ON j.id = r.journey_id
          WHERE r.journey_id = $1
            AND r.status = 'accepted'
            AND (
                (
                    r.sender_id = (SELECT auth.uid())
                    AND j.traveller_id = $2
                )
                OR
                (
                    j.traveller_id = (SELECT auth.uid())
                    AND r.sender_id = $2
                )
            )
      );
$$;

REVOKE ALL ON FUNCTION public.contact_reveal(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.contact_reveal(uuid, uuid)
TO authenticated;

COMMIT;
