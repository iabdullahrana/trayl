BEGIN;

CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id),
    body text CHECK (char_length(body) <= 2000),
    media_path text,
    media_type text CHECK (media_type IN ('image', 'video', 'document')),
    media_name text,
    media_size bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz,
    CONSTRAINT messages_have_content CHECK (body IS NOT NULL OR media_path IS NOT NULL)
);

-- Bypass request/journey RLS only for this narrow membership check, avoiding
-- policy recursion. Identity always comes from the authenticated caller.
CREATE FUNCTION public.is_chat_participant(request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.is_account_active() AND EXISTS (
        SELECT 1
        FROM public.requests AS r
        JOIN public.journeys AS j ON j.id = r.journey_id
        WHERE r.id = $1
          AND r.status = 'accepted'
          AND (
              r.sender_id = (SELECT auth.uid())
              OR j.traveller_id = (SELECT auth.uid())
          )
    );
$$;

REVOKE ALL ON FUNCTION public.is_chat_participant(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid) TO authenticated;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.messages TO authenticated;
-- Generated IDs/timestamps and read receipts cannot be supplied on INSERT.
GRANT INSERT (request_id, sender_id, body, media_path, media_type, media_name, media_size)
ON public.messages TO authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- Only the two participants in an accepted request may read its messages.
CREATE POLICY messages_select_participant
ON public.messages FOR SELECT TO authenticated
USING (public.is_chat_participant(request_id));

-- A participant may send messages only as themselves in an accepted chat.
CREATE POLICY messages_insert_sender
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.is_chat_participant(request_id)
);

-- Only the recipient may mark a message read. The column-level UPDATE grant
-- above prevents changing its sender, request, body, media, or timestamps.
CREATE POLICY messages_update_read_receipt
ON public.messages FOR UPDATE TO authenticated
USING (
    sender_id <> (SELECT auth.uid())
    AND public.is_chat_participant(request_id)
)
WITH CHECK (
    sender_id <> (SELECT auth.uid())
    AND public.is_chat_participant(request_id)
);
-- No DELETE grant or policy: API clients cannot delete messages.

CREATE INDEX messages_request_created_at_idx
ON public.messages (request_id, created_at DESC);
CREATE INDEX messages_request_unread_idx
ON public.messages (request_id) WHERE read_at IS NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Private objects are retrieved with authenticated downloads or signed URLs.
-- 15 MiB = 15 * 1024 * 1024 bytes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-media',
    'chat-media',
    false,
    15728640,
    ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/quicktime', 'application/pdf'
    ]::text[]
);

-- Paths are '<request_id>/<uuid>-<filename>'. Guard the UUID cast with CASE:
-- malformed paths are denied, rather than raising invalid-input errors.
-- Only participants in that accepted chat may upload into its folder.
CREATE POLICY chat_media_insert_participant
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'chat-media'
    AND CASE
        WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.is_chat_participant(((storage.foldername(name))[1])::uuid)
        ELSE false
    END
);

-- Only participants in that accepted chat may read its private objects.
CREATE POLICY chat_media_select_participant
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'chat-media'
    AND CASE
        WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.is_chat_participant(((storage.foldername(name))[1])::uuid)
        ELSE false
    END
);
-- No anon, UPDATE, or DELETE policy is granted for this bucket.
-- Leave storage.objects privileges intact for Supabase's Storage service.

CREATE FUNCTION public.unread_counts()
RETURNS TABLE (request_id uuid, unread bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT m.request_id, count(*) AS unread
    FROM public.messages AS m
    WHERE m.sender_id <> (SELECT auth.uid())
      AND m.read_at IS NULL
      AND public.is_chat_participant(m.request_id)
    GROUP BY m.request_id;
$$;

REVOKE ALL ON FUNCTION public.unread_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unread_counts() TO authenticated;

COMMIT;
