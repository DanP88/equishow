-- Extension du séquestre (escrow) à TOUTES les réservations.
-- Décision business 2026-06-01 : box-only LIVE depuis 2026-05-29 a été validé
-- en smoke test réel ; on étend à course + stage + transport. Logique webhook
-- + release-payment + manage-dispute identique pour les 4 modules (code
-- partagé via _shared/escrow.ts, types EscrowModule = box|course|stage|transport).
-- Hold hours 048h déjà configurés pour les 4 modules dans 040_escrow.sql.
-- Rollback : UPDATE platform_settings SET value='["box"]'::jsonb WHERE key='escrow_enabled_modules';

UPDATE public.platform_settings
SET value = '["box","course","stage","transport"]'::jsonb,
    updated_at = NOW()
WHERE key = 'escrow_enabled_modules';
