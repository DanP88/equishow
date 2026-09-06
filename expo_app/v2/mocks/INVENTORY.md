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
