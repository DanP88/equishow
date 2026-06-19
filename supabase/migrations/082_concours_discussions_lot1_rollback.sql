-- ============================================================================
-- 082 ROLLBACK — Concours discussions LOT 1
-- Annule strictement 082. Aucune autre table touchée.
--   supabase db query -f supabase/migrations/082_concours_discussions_lot1_rollback.sql
-- ============================================================================

begin;

-- Realtime
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'concours_messages'
  ) then
    alter publication supabase_realtime drop table public.concours_messages;
  end if;
end $$;

drop function if exists public.fn_concours_thread_unread(uuid);

drop policy if exists concours_thread_reads_all_own on public.concours_thread_reads;
drop table if exists public.concours_thread_reads;

drop policy if exists concours_messages_select_all on public.concours_messages;
drop policy if exists concours_messages_insert_auth on public.concours_messages;
drop policy if exists concours_messages_softdelete on public.concours_messages;

drop trigger if exists trg_concours_message_fill_author on public.concours_messages;
drop trigger if exists trg_concours_message_soft_delete on public.concours_messages;
drop function if exists public.tg_concours_message_fill_author();
drop function if exists public.tg_concours_message_soft_delete();

drop table if exists public.concours_messages;

commit;
