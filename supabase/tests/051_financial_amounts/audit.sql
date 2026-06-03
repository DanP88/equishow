with
course as (
  select 'course' as module, cd.id::text, cd.status,
    cd.nb_jours as qty,
    ca.prix_heure_ttc as unit_price,
    cd.total_amount_ht as ht_stored,
    round(coalesce(ca.prix_heure_ttc,0) * coalesce(cd.nb_jours,0), 2) as ht_expected,
    cd.platform_commission as comm_stored,
    round(round(coalesce(ca.prix_heure_ttc,0)*coalesce(cd.nb_jours,0),2) * 0.09, 2) as comm_expected,
    cd.total_amount_ttc as ttc_stored,
    round(round(coalesce(ca.prix_heure_ttc,0)*coalesce(cd.nb_jours,0),2) * 1.09, 2) as ttc_expected,
    cd.coach_id::text as party_stored, ca.auteur_id::text as party_expected, 'coach_id' as party_label,
    false as route_priced
  from public.course_demands cd left join public.coach_annonces ca on ca.id = cd.annonce_id
),
stage as (
  select 'stage', sr.id::text, sr.status,
    sr.nb_participants,
    s.prix_ttc,
    sr.price_total_ht,
    round(coalesce(s.prix_ttc,0) * coalesce(sr.nb_participants,0), 2),
    sr.platform_commission,
    round(round(coalesce(s.prix_ttc,0)*coalesce(sr.nb_participants,0),2) * 0.09, 2),
    sr.price_total_ttc,
    round(round(coalesce(s.prix_ttc,0)*coalesce(sr.nb_participants,0),2) * 1.09, 2),
    sr.coach_id::text, s.auteur_id::text, 'coach_id',
    false
  from public.stage_reservations sr left join public.stages s on s.id = sr.stage_id
),
box as (
  select 'box', br.id::text, br.status,
    br.nb_nuits,
    ba.prix_nuit_ht,
    br.price_total_ht,
    round(coalesce(ba.prix_nuit_ht,0) * coalesce(br.nb_nuits,0), 2),
    br.platform_commission,
    round(round(coalesce(ba.prix_nuit_ht,0)*coalesce(br.nb_nuits,0),2) * 0.05, 2),
    br.price_total_ttc,
    round(round(coalesce(ba.prix_nuit_ht,0)*coalesce(br.nb_nuits,0),2) * 1.05, 2),
    br.seller_id::text, ba.auteur_id::text, 'seller_id',
    false
  from public.box_reservations br left join public.box_annonces ba on ba.id = br.box_id
),
transport as (
  select 'transport', tr.id::text, tr.statut,
    tr.nb_places,
    ta.prix_ht,
    tr.prix_total_ht,
    round(coalesce(ta.prix_ht,0) * coalesce(tr.nb_places,0), 2),
    tr.commission_plateforme,
    round(round(coalesce(ta.prix_ht,0)*coalesce(tr.nb_places,0),2) * 0.05, 2),
    tr.prix_total_ttc,
    round(round(coalesce(ta.prix_ht,0)*coalesce(tr.nb_places,0),2) * 1.05, 2),
    tr.seller_id::text, ta.auteur_id::text, 'seller_id',
    (tr.total_distance_km is not null or tr.calculated_transport_price is not null
       or coalesce(tr.route_pricing_status,'') not in ('','none','disabled'))
  from public.transport_reservations tr left join public.transport_annonces ta on ta.id = tr.transport_id
),
allr as (
  select * from course union all select * from stage union all select * from box union all select * from transport
)
select module, id, status, qty, unit_price,
  ht_stored, ht_expected, ttc_stored, ttc_expected, comm_stored, comm_expected,
  route_priced,
  (not route_priced and ht_expected is not null and abs(coalesce(ht_stored,0)-ht_expected) > 0.01) as ht_mismatch,
  (not route_priced and ttc_expected is not null and abs(coalesce(ttc_stored,0)-ttc_expected) > 0.01) as ttc_mismatch,
  (party_expected is not null and party_stored is distinct from party_expected) as party_mismatch,
  party_label, party_stored, party_expected,
  (coalesce(ht_stored,0) <= 0 or coalesce(ttc_stored,0) <= 0) as nonpositive,
  (abs(coalesce(ttc_stored,0) - (coalesce(ht_stored,0)+coalesce(comm_stored,0))) > 0.01) as ttc_ne_ht_plus_comm
from allr
order by module, id;
