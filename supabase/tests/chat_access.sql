-- Integration check against an existing accepted chat. All test writes roll back.
BEGIN;
DO $$
DECLARE chat record;
BEGIN
 SELECT r.id, r.sender_id, j.traveller_id INTO chat
 FROM public.requests r JOIN public.journeys j ON j.id=r.journey_id
 JOIN public.profiles sender ON sender.id=r.sender_id AND sender.is_active
 JOIN public.profiles traveller ON traveller.id=j.traveller_id AND traveller.is_active
 WHERE r.status='accepted' LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Create an accepted chat between active accounts before running this test'; END IF;
 PERFORM set_config('test.chat',chat.id::text,true);
 PERFORM set_config('test.sender',chat.sender_id::text,true);
 PERFORM set_config('test.recipient',chat.traveller_id::text,true);
 PERFORM set_config('test.message',gen_random_uuid()::text,true);
 PERFORM set_config('request.jwt.claim.sub',chat.sender_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE affected integer;
BEGIN
 INSERT INTO public.messages(id,request_id,sender_id,body)
 VALUES(current_setting('test.message')::uuid,current_setting('test.chat')::uuid,auth.uid(),'Chat integration test; transaction will roll back');
 IF NOT EXISTS(SELECT 1 FROM public.chat_inbox() WHERE request_id=current_setting('test.chat')::uuid) THEN RAISE EXCEPTION 'Sender inbox missing accepted chat'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.messages WHERE id=current_setting('test.message')::uuid) THEN RAISE EXCEPTION 'Sender cannot read their message'; END IF;
 BEGIN
  INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting('test.chat')::uuid,current_setting('test.recipient')::uuid,'forged');
  RAISE EXCEPTION 'Forged sender was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 UPDATE public.messages SET read_at=now() WHERE id=current_setting('test.message')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Sender marked their own message read'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
 IF NOT EXISTS(SELECT 1 FROM public.chat_inbox() WHERE request_id=current_setting('test.chat')::uuid) THEN RAISE EXCEPTION 'Recipient inbox missing accepted chat'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.unread_counts() WHERE request_id=current_setting('test.chat')::uuid AND unread>0) THEN RAISE EXCEPTION 'Recipient unread count missing'; END IF;
 UPDATE public.messages SET read_at=now() WHERE id=current_setting('test.message')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Recipient cannot mark read'; END IF;
 BEGIN
  UPDATE public.messages SET body='tampered' WHERE id=current_setting('test.message')::uuid;
  RAISE EXCEPTION 'Recipient could edit body';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 IF EXISTS(SELECT 1 FROM public.chat_inbox()) THEN RAISE EXCEPTION 'Outsider inbox exposed chats'; END IF;
 IF EXISTS(SELECT 1 FROM public.messages WHERE id=current_setting('test.message')::uuid) THEN RAISE EXCEPTION 'Outsider could read message'; END IF;
END $$;
ROLLBACK;
