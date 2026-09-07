# V2 — Inventaire des mocks / adapters / fixtures / état simulé

Chaque entrée = ce qui est simulé côté front + ce qui la remplacera.

## F1
| Fichier | Simulé | Remplacé par |
|---|---|---|
| `v2/capabilities/store.ts` | ensemble des capacités (AsyncStorage `v2:capabilities`) | Phase 2 : `user_capabilities` + RLS |
| `v2/auth/session.ts` | session « nouvel utilisateur » (AsyncStorage `v2:session`) | Phase 2 : vrai Supabase Auth |
| onboarding : brouillon `v2:onboarding:draft` | champs d'onboarding | Phase 2 : `users` + profils |
| validation Organisateur | pop-up + statut `pending` | Phase 2 : `organisateur_requests` + email admin |

## F2 (navigation)
| Fichier | Simulé | Remplacé par |
|---|---|---|
| `v2/state/concoursLocal.ts` | « J'y serai » / « Suivre » / « Préparer » par concours (AsyncStorage `v2:concours-local`) | Phase 2 : `concours_presence` + colonnes `epreuves`/`besoin_*` |
| `v2/mocks/f2.ts › MOCK_ACTIONS` | bloc « À traiter » de l'Accueil | F3 : agrégat réel (demandes coach + paiements + infos org) |
| `v2/mocks/f2.ts › MOCK_COMMUNITY` | aperçu Communauté (Accueil) + `CommunauteV2` | F10 : `useCommunautePosts` (V1) |
| `v2/mocks/f2.ts › MOCK_AGENDA` | timeline `AgendaV2` | F3 : moteur `cavalier-agenda.tsx` (V1, déjà agrégé) + chips |
| `v2/mocks/f2.ts › MOCK_STUDENT_HORSES` | « Chevaux que je coache » (`ChevauxV2`) | F7 : cavaliers coachés réels |
| `v2/mocks/f2.ts › MOCK_COACH_DEMANDS` | demandes reçues (`ServiceV2` face Élèves) | F7 : `course_demands` |
| `v2/mocks/f2.ts › MOCK_CONVERSATIONS` | `MessagerieV2` + badge top bar | F3 : `useMessaging` (V1) |
| `v2/mocks/f2.ts › MOCK_COACHES_ON_CONCOURS` | coachs présents (fiche concours, `ServiceV2`) | F7 : `coach_annonces.concours_id` |
| `NotificationsV2.tsx › MOCK_NOTIFS` | liste notifications | F3 : `useNotifications` + `selectActiveNotifications` (V1) |
| `FicheConcoursV2` Radar / présence | chiffres agrégés | F7/F10 : `fn_org_concours_radar`, `concours_presence` |
| `ServiceV2` (les 3 kinds) | formulaires & résultats = maquette de structure | F5 Transport · F6 Box · F7 Coach |
| `(v2)/concours/creer`, `(v2)/chevaux/nouveau` | placeholders | F8 (cheval) / lot org (création) |

## F5 — Transport V2
| Élément | Réel (lecture seule) | Local (`v2:transport`) |
|---|---|---|
| résultats « Je cherche » | `useTransportAnnonces()` (trajets, places > 0, filtre concours ± 3 j) via `v2/adapters/transport.ts` | — |
| commission affichée | `getCommission('trajet')` (lecture seule) | — |
| résultats démo | — (mocks `v2/mocks/transport.ts`, **prototype non connecté uniquement**, tag « démo ») |
| recherche publiée (« aucun résultat ») | — | `searches[]` |
| annonce publiée (« Je propose ») | — | `offers[]` |
| réservation simulée | — | `bookings[]` (aucun Stripe, aucun paiement) |
| synchro « Mon concours » | — | `concoursLocal.needTransport` (searching / offering / done, resync → unset) |

**Backend requis Phase 2** : table `transport_demandes` (recherches) + RLS + anti-spam ;
réservation réelle via le flux `transport_reservations` + escrow existant ; masquage
d'adresse tant que non mis en relation. Rien de tout ça en F5.

## F6 — Box V2
| Élément | Réel (lecture seule) | Local (`v2:box`) |
|---|---|---|
| résultats « Je cherche » | `useBoxAnnonces()` (boxes dispo > 0, filtre concours, chevauchement de période) via `v2/adapters/box.ts` | — |
| commission affichée | `getCommission('box')` (lecture seule) | — |
| résultats démo | — (mocks `v2/mocks/box.ts`, **prototype non connecté uniquement**, tag « démo ») |
| recherche publiée (« aucun résultat ») | — | `searches[]` |
| annonce publiée (« Je propose ») | — | `offers[]` |
| réservation simulée | — | `bookings[]` (aucun Stripe, aucun paiement ; total = prix/nuit × nuits + commission) |
| synchro « Mon concours » | — | `concoursLocal.needBox` (searching / offering / done, resync → unset) |

**Backend requis Phase 2** : table `box_demandes` (recherches) + RLS + anti-spam ;
réservation réelle via le flux `box_reservations` + escrow existant + trigger de
pic-de-concurrence (mig 104) ; masquage d'adresse tant que non mis en relation.
Rien de tout ça en F6.

## F7 — Coach V2
| Élément | Réel (lecture seule) | Local (`v2:coach`) |
|---|---|---|
| résultats « Je cherche » | `useCoachAnnonces()` (places > 0, filtre concours + discipline) via `v2/adapters/coach.ts` | — |
| demandes reçues (« Mes élèves ») | `useMyCourseDemands()` filtré `coach = moi` + `pending` (lecture seule, **0 write**) | accept/refus = état visuel local (`useState`), non persisté |
| commission affichée | `getCommission('cours')` (lecture seule) | — |
| résultats / demandes démo | — (mocks `v2/mocks/coach.ts` + liste interne `useV2CoachDemands`, **prototype non connecté uniquement**) |
| demande de coaching publiée | — | `searches[]` |
| annonce de coaching publiée | — | `offers[]` |
| séance réservée simulée | — | `bookings[]` (aucun Stripe ; total = prix/séance × nb + commission) |
| synchro « Mon concours » | — | `concoursLocal.needCoach` (searching / offering / done ; resync → unset) |
| capacité Coach | `useCapabilities()` seed = vrai `users.role` | opt-in local (`CoachOptInV2` → `caps.request('coach')`), gate `CoachProposeV2` / `CoachElevesV2` |

**Backend requis Phase 2** : `course_demands` (demandes réelles) + escrow existant ;
gestion réelle accept/refus + planning des séances ; gating capacité Coach réel
(`user_capabilities`). Rien de tout ça en F7.

## F8 — Cheval V2
| Élément | Réel (lecture seule) | Local (`v2:*`) |
|---|---|---|
| chevaux réels | `useMyChevaux()` / `useCheval(id)` — **jamais de mutation** | — |
| chevaux V2 (CAS B « Ajouter un cheval ») | — | `v2:chevaux` (`v2/state/chevauxLocal.ts`, ids `v2c-…`, CRUD local). **Aucun INSERT Supabase.** |
| sélection cheval(s) par concours | — | `concoursLocal.selectedHorseIds[]` (multi, propre à chaque concours). `chevalId` déprécié = `selectedHorseIds[0]`. |
| contexte cheval des services | — | `useV2ContestHorses(concoursId)` (`v2/state/contestHorses.ts`) = fusion réel + local, libellés prêts. Transport / Box / Coach le **lisent** — aucun sélecteur. |
| fiche cheval réelle | `useCheval` → LECTURE SEULE (bouton « ouvrir la fiche V1 » = navigation seule) | — |
| fiche / édition cheval local | — | `ChevalV2` / `ChevalFormV2`, routes `app/(v2)/chevaux/{[id],[id]/modifier,nouveau}` |

**Limite connue** : une réservation Box / une demande Coach reste **1 enregistrement** (`chevalId` = 1ᵉʳ sélectionné) — la réservation multi-box / multi-séance par cheval est un lot ultérieur (signalée à l'écran). Le champ « nombre de chevaux/box » est prérempli sur le nombre sélectionné mais éditable.

**Backend requis Phase 2** : `concours_presence` + colonne chevaux du concours ;
création cheval réelle (INSERT `chevaux` + RLS + Storage photo). Rien de tout ça en F8.

## F2 — `ServiceV2` = shim de redirection
Depuis F5/F6/F7, `app/(v2)/service/[kind]` ne fait plus que rediriger vers
`/(v2)/transport` · `/(v2)/box` · `/(v2)/coach` (contexte conservé). Les mocks
`MOCK_COACHES_ON_CONCOURS` / `MOCK_COACH_DEMANDS` (f2.ts) ne sont plus utilisés
(remplacés par `v2/adapters/coach.ts`) ; conservés pour compat d'import.

## F4 — fiche concours = tableau de bord (état LOCAL, lecture seule côté réel)
| Élément | Réel (lecture seule) | Local (`v2:concours-local`) |
|---|---|---|
| identité concours | `useConcours(id)` | — |
| « Vous organisez ce concours » | `useMyConcours()` (id ∈ mes concours) | — |
| chevaux à sélectionner | `useMyChevaux()` | `chevalId` choisi |
| J'y serai / Suivre | — | `going` / `following` |
| épreuves | `concours.liste_epreuves` (référence) | `epreuves[]` saisis |
| Transport / Box / Coach — état | — | `needTransport/Box/Coach` : done · searching · offering · unset · none |
| préparation X/5 | — | dérivée de l'état local |
| « Vous y coachez » (séances) | — | mock F2 (rebranché F7) |
| Radar organisateur | lien vers écrans V1 | mock F2 (rebranché F10) |

Passerelles : `/(v2)/service/[kind]?concoursId=…&face=…&chevalId=…` — le service
reçoit le contexte (concours + lieu + dates + cheval) déjà prérempli.

## F3 — moteurs réels branchés (lecture seule, repli démo si vide)
| adapter | hooks V1 réutilisés | repli si vide |
|---|---|---|
| `v2/adapters/agenda.ts` | useMyTransportReservations · useMyBoxReservations · useMyCourseDemands · useMyStageReservations · useConcoursList + concoursLocal | MOCK_AGENDA |
| `v2/adapters/notifications.ts` | useActiveNotifications (= useNotifications + selectActiveNotifications) | MOCK interne |
| `v2/adapters/messaging.ts` | useConversations | MOCK interne |

Non branché en Phase 1 (écritures) : « marquer lu », envoi de message, dépôt d'avis.
Sans session réelle → les 3 adapters retombent sur la démo (badge « démonstration »).

## Données RÉELLES utilisées en F2 (lecture seule, aucun write)
- `useConcoursList()` — liste des concours (Accueil hero, Concours › Découvrir/Suivis)
- `useConcours(id)` — identité d'un concours (fiche)
- `useMyConcours()` — concours organisés (Concours › Organisés)
- `useMyChevaux()` — mes chevaux (Chevaux, Préparer)
- `useAvisStats(userId)` — note moyenne (Profil)
- `useAuth().profile` — identité / disciplines (Profil, opt-in Coach)
