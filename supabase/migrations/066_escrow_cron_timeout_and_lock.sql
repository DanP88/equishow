-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 066 — Fix P0 cron auto-release escrow : timeout pg_net + mutex overlap
--
-- Contexte (audit Gouvernance & Observabilité Escrow, 2026-06-11) :
--   • pg_net coupe l'appel HTTP à 5000 ms (timeout par défaut). escrow-cron-release
--     (appels Stripe /transfers en série) dépasse 5 s → 5/6 derniers runs ont fini
--     en "Timeout of 5000 ms reached" (net._http_response.status_code = NULL).
--   • pg_cron affiche "succeeded" car il ne voit que la mise en file du net.http_post,
--     pas la réponse Edge → faux signal.
--   • 2 paiements transport échus restent 'held' (release_attempts=0), libération
--     auto inopérante. Cause probable secondaire : exécutions concurrentes/zombies
--     issues des timeouts → besoin d'un mutex.
--
-- Ce que fait cette migration (UNIQUEMENT le transport/plomberie, AUCUNE règle métier) :
--   A) Reschedule le job 'equishow_escrow_release_hourly' à l'IDENTIQUE (même
--      endpoint, même secret Vault, même fréquence 0 * * * *) mais avec
--      timeout_milliseconds := 30000 sur net.http_post.
--   B) Crée un verrou de bail (lease) mono-ligne `escrow_cron_lock` consommé par
--      l'Edge Function pour empêcher deux runs simultanés de traiter les mêmes
--      paiements. Self-healing (expiration de bail) → pas de deadlock si un run crash.
--
-- NE TOUCHE PAS : montants, held→releasing→released, Idempotency-Key Stripe,
--   délai 48h, statuts métier, autres jobs cron, écrans. Additif / réversible.
--   Le secret n'est PAS écrit en clair (lu depuis Vault au runtime, comme mig 042).
--
-- Rollback :
--   drop table if exists public.escrow_cron_lock;
--   -- puis rejouer mig 042 pour revenir au timeout implicite (déconseillé).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A) Verrou de bail mono-ligne (mutex applicatif PostgREST-friendly) ───────
create table if not exists public.escrow_cron_lock (
  id           boolean primary key default true,
  locked_until timestamptz,
  locked_by    text,
  constraint escrow_cron_lock_singleton check (id = true)
);

insert into public.escrow_cron_lock (id, locked_until, locked_by)
values (true, null, null)
on conflict (id) do nothing;

-- Seul service_role (Edge) manipule ce verrou. RLS ON sans policy → tout JWT
-- utilisateur est refusé, service_role bypass.
alter table public.escrow_cron_lock enable row level security;

comment on table public.escrow_cron_lock is
  'Mutex de bail mono-ligne pour escrow-cron-release (mig 066). L''Edge pose
   locked_until=now+10min/locked_by=token au démarrage si le bail est libre,
   le relâche en fin de run. Empêche les exécutions concurrentes/zombies.';


-- ── B) Reschedule du cron avec timeout_milliseconds := 30000 ─────────────────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron absent — activer via Dashboard, puis rejouer cette migration';
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_net absent — activer via Dashboard, puis rejouer cette migration';
    return;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'escrow_cron_secret') then
    raise notice 'secret vault escrow_cron_secret absent — cron NON re-planifié';
    return;
  end if;

  -- Idempotent : retire le job existant (même nom) avant de le re-planifier.
  perform cron.unschedule(jobid) from cron.job where jobname = 'equishow_escrow_release_hourly';

  perform cron.schedule(
    'equishow_escrow_release_hourly',
    '0 * * * *',  -- INCHANGÉ : toutes les heures (UTC)
    $job$
      select net.http_post(
        url := 'https://vhkjvnpxcqlmpokrgymx.supabase.co/functions/v1/escrow-cron-release',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'escrow_cron_secret' limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$
  );

  raise notice 'cron equishow_escrow_release_hourly re-planifié (0 * * * *, timeout 30000 ms).';
end $$;
