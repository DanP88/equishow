begin;
create temp table _a(ord int, test text, outcome text, exploitable text) on commit drop;
-- T5 course UPDATE ttc=0.60 (sans 051)
do $$ declare v numeric; e text:=null; begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.course_demands set total_amount_ttc=0.60 where id='833f252b-c1f6-4397-901e-d907435e8920'; exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select total_amount_ttc into v from public.course_demands where id='833f252b-c1f6-4397-901e-d907435e8920';
  insert into _a values (5,'T5 course UPDATE', coalesce('rejet:'||e,'ttc='||v::text), case when v=0.60 then 'OUI (fraude réussie)' else 'non' end);
end $$;
-- T6 stage
do $$ declare v numeric; e text:=null; begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.stage_reservations set price_total_ttc=0.60 where id='51840226-7bbb-4a8b-9cd1-9ae68ede9535'; exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select price_total_ttc into v from public.stage_reservations where id='51840226-7bbb-4a8b-9cd1-9ae68ede9535';
  insert into _a values (6,'T6 stage UPDATE', coalesce('rejet:'||e,'ttc='||v::text), case when v=0.60 then 'OUI (fraude réussie)' else 'non' end);
end $$;
-- T7 box
do $$ declare v numeric; e text:=null; begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.box_reservations set price_total_ttc=0.60 where id='ca5f403c-a848-41b6-84ef-1b82a201fb7d'; exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select price_total_ttc into v from public.box_reservations where id='ca5f403c-a848-41b6-84ef-1b82a201fb7d';
  insert into _a values (7,'T7 box UPDATE', coalesce('rejet:'||e,'ttc='||v::text), case when v=0.60 then 'OUI (fraude réussie)' else 'non' end);
end $$;
-- T8 transport UPDATE
do $$ declare v numeric; e text:=null; begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin update public.transport_reservations set prix_total_ttc=0.60 where id='0d18a272-4f13-4fc6-83d5-5b746a56d80f'; exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select prix_total_ttc into v from public.transport_reservations where id='0d18a272-4f13-4fc6-83d5-5b746a56d80f';
  insert into _a values (8,'T8 transport UPDATE', coalesce('rejet:'||e,'ttc='||v::text), case when v=0.60 then 'OUI (fraude réussie)' else 'non' end);
end $$;
-- T4/B1 transport INSERT trajet ht=0.01
do $$ declare v numeric; e text:=null; v_id uuid:=gen_random_uuid(); begin
  perform set_config('request.jwt.claims','{"sub":"93947e0c-3726-4551-b834-a1135d816336","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin insert into public.transport_reservations (id,transport_id,buyer_id,seller_id,nb_places,prix_total_ht,commission_plateforme,prix_total_ttc,statut)
    values (v_id,'5b273461-5575-4297-b208-48878d7d7ec6','93947e0c-3726-4551-b834-a1135d816336','93947e0c-3726-4551-b834-a1135d816336',2,0.01,0.01,0.01,'pending'); exception when others then e:=SQLERRM; end;
  execute 'reset role';
  select prix_total_ttc into v from public.transport_reservations where id=v_id;
  insert into _a values (4,'T4/B1 transport INSERT', coalesce('echec:'||e,'ttc='||coalesce(v::text,'NULL')), case when v=0.01 then 'OUI (fraude réussie)' else 'non' end);
end $$;
select ord, test, outcome, exploitable from _a order by ord;
rollback;
