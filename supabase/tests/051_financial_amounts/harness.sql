-- ════════════════════════════════════════════════════════════════════════
-- HARNESS DE TESTS 051 (à exécuter APRÈS le DDL 051, dans la même transaction)
-- Simule l'acheteur sous RLS (set local role authenticated + jwt claims).
-- Chaque test capture son verdict dans _r. Tout est annulé (rollback).
-- ════════════════════════════════════════════════════════════════════════
create temp table _r(ord int, test text, scenario text, outcome text, verdict text) on commit drop;

-- Constantes (IDs réels prod)
-- BUYER/cavalier : 93947e0c-3726-4551-b834-a1135d816336
-- course paid    : 833f252b-... (ttc attendu 218.00, coach 7d9d...)
-- stage paid     : 51840226-... (ttc attendu 545.00, coach 49bd...)
-- box paid       : ca5f403c-... (ttc attendu 94.50, seller 7d9d...)
-- transport route: 0d18a272-... (ttc attendu 1655.64, seller 7d9d...)
-- annonce trajet : 5b273461-... (prix_ht=1, auteur 7d9d...)
-- annonce location: 89acbf43-... (auteur 7d9d...)

-- ── ENV : auth.uid() sous authenticated = buyer ──
do $$
declare v uuid;
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated'; v := auth.uid(); execute 'reset role';
  insert into _r values (0,'ENV','auth.uid() sous authenticated',
    'uid='||coalesce(v::text,'NULL'),
    case when v::text='93947e0c-3726-4551-b834-a1135d816336' then 'OK' else 'FAIL' end);
end $$;

-- ── T5 : course UPDATE ttc=0.60 (fraude S5) → recalculé 218.00 ──
do $$
declare v numeric; e text:=null;
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.course_demands set total_amount_ttc=0.60 where id='833f252b-c1f6-4397-901e-d907435e8920';
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select total_amount_ttc into v from public.course_demands where id='833f252b-c1f6-4397-901e-d907435e8920';
  insert into _r values (5,'T5','course UPDATE ttc=0.60',
    coalesce('REJET: '||e, 'ttc='||v::text)||' (attendu 218.00)',
    case when v=218.00 then 'PASS' else 'FAIL' end);
end $$;

-- ── T6 : stage UPDATE ttc=0.60 → 545.00 ──
do $$
declare v numeric; e text:=null;
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.stage_reservations set price_total_ttc=0.60 where id='51840226-7bbb-4a8b-9cd1-9ae68ede9535';
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select price_total_ttc into v from public.stage_reservations where id='51840226-7bbb-4a8b-9cd1-9ae68ede9535';
  insert into _r values (6,'T6','stage UPDATE ttc=0.60',
    coalesce('REJET: '||e, 'ttc='||v::text)||' (attendu 545.00)',
    case when v=545.00 then 'PASS' else 'FAIL' end);
end $$;

-- ── T7 : box UPDATE ttc=0.60 → 94.50 ──
do $$
declare v numeric; e text:=null;
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.box_reservations set price_total_ttc=0.60 where id='ca5f403c-a848-41b6-84ef-1b82a201fb7d';
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select price_total_ttc into v from public.box_reservations where id='ca5f403c-a848-41b6-84ef-1b82a201fb7d';
  insert into _r values (7,'T7','box UPDATE ttc=0.60',
    coalesce('REJET: '||e, 'ttc='||v::text)||' (attendu 94.50)',
    case when v=94.50 then 'PASS' else 'FAIL' end);
end $$;

-- ── T8 : transport (route-priced) UPDATE ttc=0.60 → 1655.64 ──
do $$
declare v numeric; e text:=null;
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.transport_reservations set prix_total_ttc=0.60 where id='0d18a272-4f13-4fc6-83d5-5b746a56d80f';
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select prix_total_ttc into v from public.transport_reservations where id='0d18a272-4f13-4fc6-83d5-5b746a56d80f';
  insert into _r values (8,'T8','transport route-priced UPDATE ttc=0.60',
    coalesce('REJET: '||e, 'ttc='||v::text)||' (attendu 1655.64 inchangé)',
    case when v=1655.64 then 'PASS' else 'FAIL' end);
end $$;

-- ── S2 : course UPDATE coach_id=autre → re-pin auteur annonce (7d9d...) ──
do $$
declare v text; e text:=null;
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.course_demands set coach_id='49bd56d2-d87b-4f96-bd59-be2afaed8ccd' where id='833f252b-c1f6-4397-901e-d907435e8920';
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select coach_id::text into v from public.course_demands where id='833f252b-c1f6-4397-901e-d907435e8920';
  insert into _r values (9,'S2','course UPDATE coach_id=autre',
    coalesce('REJET: '||e, 'coach_id='||v)||' (attendu 7d9d...auteur)',
    case when v='7d9d73e7-0214-42d9-9152-0e70fd9c407a' then 'PASS' else 'FAIL' end);
end $$;

-- ── T4 / B1 : transport INSERT trajet prix bidon → recalculé (ht=1×2=2.00, ttc=2.10) ──
do $$
declare v numeric; e text:=null; v_id uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    insert into public.transport_reservations
      (id, transport_id, buyer_id, seller_id, nb_places, prix_total_ht, commission_plateforme, prix_total_ttc, statut)
    values (v_id,'5b273461-5575-4297-b208-48878d7d7ec6','93947e0c-3726-4551-b834-a1135d816336',
            '93947e0c-3726-4551-b834-a1135d816336', 2, 0.01, 0.01, 0.01, 'pending');
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select prix_total_ttc into v from public.transport_reservations where id=v_id;
  insert into _r values (4,'T4/B1','transport INSERT trajet ht=0.01 nb_places=2',
    coalesce('ECHEC INSERT: '||e, 'ttc='||coalesce(v::text,'NULL'))||' (attendu 2.10)',
    case when v=2.10 then 'PASS' else 'FAIL' end);
end $$;

-- ── B1+S5 chemin complet transport : INSERT bidon puis UPDATE bidon → 2.10 ──
do $$
declare v numeric; e text:=null; v_id uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    insert into public.transport_reservations
      (id, transport_id, buyer_id, seller_id, nb_places, prix_total_ht, commission_plateforme, prix_total_ttc, statut)
    values (v_id,'5b273461-5575-4297-b208-48878d7d7ec6','93947e0c-3726-4551-b834-a1135d816336',
            '93947e0c-3726-4551-b834-a1135d816336', 2, 0.01, 0.01, 0.01, 'pending');
    update public.transport_reservations set prix_total_ttc=0.60, prix_total_ht=0.50 where id=v_id;
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select prix_total_ttc into v from public.transport_reservations where id=v_id;
  insert into _r values (10,'B1+S5','transport INSERT bidon + UPDATE bidon',
    coalesce('ERR: '||e, 'ttc='||coalesce(v::text,'NULL'))||' (attendu 2.10)',
    case when v=2.10 then 'PASS' else 'FAIL' end);
end $$;

-- ── LOCATION non-régression #1 : INSERT location → réservation OK, montants INCHANGÉS ──
do $$
declare v numeric; vseller text; e text:=null; v_id uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    insert into public.transport_reservations
      (id, transport_id, buyer_id, seller_id, nb_places, prix_total_ht, commission_plateforme, prix_total_ttc, statut)
    values (v_id,'89acbf43-f05f-4cc9-831b-7d1823c209bb','93947e0c-3726-4551-b834-a1135d816336',
            '00000000-0000-0000-0000-000000000000', 1, 100.00, 5.00, 105.00, 'pending');
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select prix_total_ttc, seller_id::text into v, vseller from public.transport_reservations where id=v_id;
  insert into _r values (11,'LOC-INSERT','location INSERT (ttc=105 inchangé, seller pinné)',
    coalesce('ECHEC INSERT: '||e, 'ttc='||coalesce(v::text,'NULL')||' seller='||coalesce(vseller,'NULL'))||' (attendu 105.00 + seller 7d9d...)',
    case when v=105.00 and vseller='7d9d73e7-0214-42d9-9152-0e70fd9c407a' then 'PASS' else 'FAIL' end);
end $$;

-- ── LOCATION non-régression #2 : UPDATE frauduleux montant location → GELÉ à 105 ──
do $$
declare v numeric; e text:=null; v_id uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    insert into public.transport_reservations
      (id, transport_id, buyer_id, seller_id, nb_places, prix_total_ht, commission_plateforme, prix_total_ttc, statut)
    values (v_id,'89acbf43-f05f-4cc9-831b-7d1823c209bb','93947e0c-3726-4551-b834-a1135d816336',
            '00000000-0000-0000-0000-000000000000', 1, 100.00, 5.00, 105.00, 'pending');
    update public.transport_reservations set prix_total_ttc=0.60, prix_total_ht=0.50 where id=v_id;
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select prix_total_ttc into v from public.transport_reservations where id=v_id;
  insert into _r values (12,'LOC-FREEZE','location UPDATE ttc=0.60 (doit rester gelé)',
    coalesce('REJET: '||e, 'ttc='||coalesce(v::text,'NULL'))||' (attendu 105.00 gelé)',
    case when v=105.00 then 'PASS' else 'FAIL' end);
end $$;

-- ── NON-RÉGRESSION : modif légitime de quantité (course nb_jours=2) → recalcul correct (ttc=436) ──
do $$
declare v numeric; e text:=null;
begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.course_demands set nb_jours=2 where id='833f252b-c1f6-4397-901e-d907435e8920';
  exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select total_amount_ttc into v from public.course_demands where id='833f252b-c1f6-4397-901e-d907435e8920';
  insert into _r values (13,'NONREG-QTY','course nb_jours=2 (légitime)',
    coalesce('REJET: '||e, 'ttc='||v::text)||' (attendu 436.00 recalculé)',
    case when v=436.00 then 'PASS' else 'FAIL' end);
end $$;

-- ── NON-RÉGRESSION : service_role change status=completed → OK, montants intacts ──
do $$
declare v numeric; vs text; e text:=null;
begin
  begin
    execute 'set local role service_role';
    update public.course_demands set status='completed' where id='b46b0ff3-e437-4f17-8427-e53596f4abdb';
    execute 'reset role';
  exception when others then e:=SQLERRM; execute 'reset role'; end;
  select total_amount_ttc, status into v, vs from public.course_demands where id='b46b0ff3-e437-4f17-8427-e53596f4abdb';
  insert into _r values (14,'NONREG-SVC','service_role UPDATE status=completed',
    coalesce('ERR: '||e, 'status='||vs||' ttc='||v::text)||' (attendu completed + ttc inchangé)',
    case when e is null and v=436.00 then 'PASS' else 'FAIL' end);
end $$;

select ord, test, scenario, outcome, verdict from _r order by ord;
rollback;
