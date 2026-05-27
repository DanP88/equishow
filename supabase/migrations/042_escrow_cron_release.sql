-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 042 — pg_cron backstop libération séquestre (escrow-cron-release)
--
-- Planifie un appel horaire de l'Edge Function escrow-cron-release, qui libère
-- (Stripe Transfer) les paiements 'held' dont release_due_at est échu, ou — filet
-- ultime — paid_at + escrow_hard_cap_days dépassé. Empêche tout blocage indéfini.
--
-- NON DESTRUCTIF : cron.schedule uniquement. Inerte tant qu'aucun paiement n'est
-- 'held' non bloqué et échu (escrow OFF → 0 candidat). N'altère AUCUNE table.
--
-- Le secret partagé est lu depuis Vault (escrow_cron_secret) AU RUNTIME : il
-- n'est pas écrit en clair dans cron.job.command. Prérequis :
--   • vault.create_secret(<valeur>, 'escrow_cron_secret') exécuté (== env
--     CRON_SECRET de la fonction),
--   • extensions pg_cron + pg_net activées (Dashboard → Database → Extensions).
-- ─────────────────────────────────────────────────────────────────────────────
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
    raise notice 'secret vault escrow_cron_secret absent — cron NON planifié (créer le secret puis rejouer)';
    return;
  end if;

  -- Idempotent : retire un job existant éventuel.
  perform cron.unschedule(jobid) from cron.job where jobname = 'equishow_escrow_release_hourly';

  perform cron.schedule(
    'equishow_escrow_release_hourly',
    '0 * * * *',  -- toutes les heures (UTC)
    $job$
      select net.http_post(
        url := 'https://vhkjvnpxcqlmpokrgymx.supabase.co/functions/v1/escrow-cron-release',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'escrow_cron_secret' limit 1)
        ),
        body := '{}'::jsonb
      );
    $job$
  );

  raise notice 'cron equishow_escrow_release_hourly planifié (0 * * * *).';
end $$;
