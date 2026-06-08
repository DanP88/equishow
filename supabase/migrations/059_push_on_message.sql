-- ═══════════════════════════════════════════════════════════════════════════
-- 059_push_on_message.sql
-- Lot P0 (serveur) — Push « nouveau message » : trigger → Edge send-push.
--
-- Quand une notification de type 'message' est insérée (par le trigger 058
-- AFTER INSERT ON messages), ce trigger appelle l'Edge Function `send-push`
-- en HTTP via pg_net, qui relaie vers l'Expo Push API.
--
-- Périmètre strict P0 :
--   - ne fire QUE pour type='message' (clause WHEN) → 058 et toutes les autres
--     notifications restent intactes ;
--   - 058 (fn_notify_new_message / trg_zz_notify_new_message) NON touché ;
--   - aucun email, aucune préférence, aucune file, aucun receipt ;
--   - ne bloque JAMAIS l'insertion de la notification (EXCEPTION → return new) ;
--   - si l'URL/secret Vault n'est pas configuré → no-op silencieux.
--
-- Config requise (hors migration, voir doc) :
--   select vault.create_secret('<EDGE_URL>/send-push', 'send_push_url');
--   select vault.create_secret('<PUSH_DISPATCH_SECRET>', 'push_dispatch_secret');
--
-- Rollback :
--   drop trigger if exists trg_zz_push_on_message on public.notifications;
--   drop function if exists public.fn_push_on_message();
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fn_push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- URL + secret depuis le Vault (jamais en clair dans la migration).
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'send_push_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_dispatch_secret' limit 1;

  -- Non configuré → no-op (l'insertion de la notif reste valide).
  if v_url is null then
    return new;
  end if;

  -- Appel asynchrone à l'Edge send-push (best-effort, ne bloque pas la transaction).
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-push-secret', coalesce(v_secret, '')
               ),
    body    := jsonb_build_object('notification_id', new.id)
  );

  return new;
exception
  when others then
    -- Sécurité : un échec de dispatch ne doit JAMAIS empêcher la notif ni le message.
    return new;
end;
$$;

drop trigger if exists trg_zz_push_on_message on public.notifications;
create trigger trg_zz_push_on_message
  after insert on public.notifications
  for each row
  when (new.type = 'message')
  execute function public.fn_push_on_message();
