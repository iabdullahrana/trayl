BEGIN;

-- A cleanup claim serializes failed-send cleanup against a late message insert.
-- Retain the claim after Storage deletion so retries cannot attach a deleted path.
CREATE TABLE public.chat_media_cleanup (
    path text PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_media_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_media_cleanup FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.chat_media_path_available(object_path text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    -- Serialize late Storage metadata inserts with cleanup claims as well.
    PERFORM pg_advisory_xact_lock(hashtextextended(object_path, 0));
    RETURN NOT EXISTS (SELECT 1 FROM public.chat_media_cleanup WHERE path = object_path);
END;
$$;
REVOKE ALL ON FUNCTION public.chat_media_path_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_media_path_available(text) TO authenticated;

-- Reject late uploads to paths already abandoned by a failed send.
CREATE POLICY chat_media_no_abandoned_upload ON storage.objects AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'chat-media' OR public.chat_media_path_available(name));

CREATE FUNCTION public.prepare_chat_media_cleanup(chat_id uuid, object_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE object_owner text; claimed_owner uuid;
BEGIN
    IF auth.uid() IS NULL OR split_part(object_path, '/', 1) <> chat_id::text
       OR object_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$'
       THEN RETURN false; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(object_path, 0));
    IF EXISTS (SELECT 1 FROM public.messages WHERE media_path = object_path) THEN RETURN false; END IF;
    SELECT owner_id INTO claimed_owner FROM public.chat_media_cleanup WHERE path = object_path;
    IF FOUND THEN RETURN claimed_owner = auth.uid(); END IF;
    SELECT owner_id INTO object_owner FROM storage.objects WHERE bucket_id = 'chat-media' AND name = object_path;
    IF FOUND THEN
        IF object_owner IS DISTINCT FROM auth.uid()::text THEN RETURN false; END IF;
    ELSIF NOT public.is_chat_participant(chat_id) THEN RETURN false;
    END IF;
    INSERT INTO public.chat_media_cleanup(path, owner_id) VALUES(object_path, auth.uid());
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_chat_media_cleanup(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_chat_media_cleanup(uuid, text) TO authenticated;

CREATE FUNCTION public.can_cleanup_chat_media(object_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.chat_media_cleanup WHERE path = $1 AND owner_id = (SELECT auth.uid()))
    AND NOT EXISTS (SELECT 1 FROM public.messages WHERE media_path = $1); $$;
REVOKE ALL ON FUNCTION public.can_cleanup_chat_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cleanup_chat_media(text) TO authenticated;

-- Cleanup can remove only a caller-owned, explicitly abandoned, unused upload.
-- SELECT is also needed by Storage removal, including after chat access ends.
CREATE POLICY chat_media_cleanup_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media' AND owner_id = (SELECT auth.uid())::text AND public.can_cleanup_chat_media(name));
CREATE POLICY chat_media_cleanup_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND owner_id = (SELECT auth.uid())::text AND public.can_cleanup_chat_media(name));

CREATE FUNCTION public.validate_chat_message_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE uploaded record; expected_type text;
BEGIN
    IF NEW.media_path IS NULL THEN RETURN NEW; END IF;
    IF auth.uid() IS NULL OR NEW.sender_id <> auth.uid()
       OR split_part(NEW.media_path, '/', 1) <> NEW.request_id::text
       OR NEW.media_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$'
       THEN RAISE EXCEPTION 'Invalid attachment path' USING ERRCODE = '23514'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.media_path, 0));
    IF NOT public.chat_media_path_available(NEW.media_path) THEN
       RAISE EXCEPTION 'Attachment upload was abandoned' USING ERRCODE = '23514'; END IF;
    SELECT owner_id, metadata INTO uploaded FROM storage.objects WHERE bucket_id = 'chat-media' AND name = NEW.media_path;
    IF NOT FOUND OR uploaded.owner_id IS DISTINCT FROM auth.uid()::text THEN
       RAISE EXCEPTION 'Attachment upload is unavailable' USING ERRCODE = '23514'; END IF;
    expected_type := CASE
        WHEN uploaded.metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp','image/gif') THEN 'image'
        WHEN uploaded.metadata->>'mimetype' IN ('video/mp4','video/quicktime') THEN 'video'
        WHEN uploaded.metadata->>'mimetype' = 'application/pdf' THEN 'document'
        ELSE NULL END;
    IF expected_type IS NULL OR NEW.media_type IS DISTINCT FROM expected_type
       OR NEW.media_size IS NULL OR NEW.media_size NOT BETWEEN 1 AND 15728640
       OR NEW.media_size IS DISTINCT FROM (uploaded.metadata->>'size')::bigint
       OR NEW.media_name IS NULL OR char_length(NEW.media_name) NOT BETWEEN 1 AND 100 THEN
       RAISE EXCEPTION 'Invalid attachment metadata' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_chat_message_media() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER messages_validate_media BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message_media();
CREATE INDEX messages_media_path_idx ON public.messages(media_path) WHERE media_path IS NOT NULL;
COMMIT;
