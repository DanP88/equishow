import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/cheval.dart';
import '../providers/chevaux_provider.dart';

// ── Sheet édition complète d'un cheval ────────────────────────────────────────
//
// Structure UX :
//   1. Champs obligatoires (toujours visibles) : Type + Nom
//   2. Informations complémentaires (section repliable unique)
//      └── 6 sous-sections individuellement dépliables :
//          Identification / Santé & Concours / Profil & Comportement /
//          Sport & Travail / Gestion & Environnement / Personnes liées

class ChevalEditSheet extends ConsumerStatefulWidget {
  const ChevalEditSheet({super.key, required this.cheval});
  final Cheval cheval;

  @override
  ConsumerState<ChevalEditSheet> createState() => _ChevalEditSheetState();
}

class _ChevalEditSheetState extends ConsumerState<ChevalEditSheet> {
  // ── Obligatoires ──────────────────────────────────────────────────────────
  late TypeCheval _type;
  late final TextEditingController _nomCtrl;

  // ── Identification ────────────────────────────────────────────────────────
  late final TextEditingController _raceCtrl;
  late final TextEditingController _robeCtrl;
  late final TextEditingController _anneeCtrl;
  late final TextEditingController _tailleCtrl;
  late final TextEditingController _sireCtrl;
  String? _sexe;

  // ── Comportement ──────────────────────────────────────────────────────────
  late Set<Temperament> _temperament;
  ComportementTransport? _comportementTransport;
  HabitudesVie? _habitudes;
  Sociabilite? _sociabilite;
  late final TextEditingController _particularitesCtrl;

  // ── Sport ─────────────────────────────────────────────────────────────────
  late Set<String> _disciplines;
  NiveauPratique? _niveauPratique;
  NiveauTravail? _niveauTravail;
  FrequenceTravail? _frequenceTravail;
  late final TextEditingController _objectifsCtrl;

  // ── Santé ─────────────────────────────────────────────────────────────────
  DateTime? _dateVaccinGrippe;
  DateTime? _dateVaccinRhino;
  DateTime? _dateVermifuge;
  DateTime? _dateMarechal;
  TypeFerrure? _typeFerrure;
  DateTime? _dateDentiste;
  DateTime? _dateOsteo;
  late final TextEditingController _antecedentsCtrl;
  late final TextEditingController _allergiesCtrl;
  late final TextEditingController _pathologiesCtrl;

  // ── Gestion ───────────────────────────────────────────────────────────────
  LienUtilisateur? _proprietaire;
  LienUtilisateur? _demiPensionnaire;
  LienUtilisateur? _responsable;
  late final TextEditingController _ecurieCtrl;
  TypeLitiere? _typeLitiere;

  // ── État UI ───────────────────────────────────────────────────────────────
  bool _loading = false;
  bool _complementairesExpanded = false;
  final _expandedSections = <String>{};

  static const _disciplinesOptions = ['CSO', 'Dressage', 'CCE', 'Hunter', 'Équitation de Travail', 'Autre'];
  static const _sexeOptions = ['Hongre', 'Jument', 'Étalon'];

  // ── Init ──────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    final c = widget.cheval;
    final s = c.sante;
    final g = c.gestion;

    _type              = c.type;
    _nomCtrl           = TextEditingController(text: c.nom);
    _raceCtrl          = TextEditingController(text: c.race ?? '');
    _robeCtrl          = TextEditingController(text: c.robe ?? '');
    _anneeCtrl         = TextEditingController(text: c.anneeNaissance?.toString() ?? '');
    _tailleCtrl        = TextEditingController(text: c.taille ?? '');
    _sireCtrl          = TextEditingController(text: c.numeroSire ?? '');
    _sexe              = c.sexe;
    _temperament       = Set.from(c.temperament);
    _comportementTransport = c.comportementTransport;
    _habitudes         = c.habitudes;
    _sociabilite       = c.sociabilite;
    _particularitesCtrl = TextEditingController(text: c.particularitesPhysiques ?? '');
    _disciplines       = Set.from(c.disciplines);
    _niveauPratique    = c.niveauPratique;
    _niveauTravail     = c.niveauTravail;
    _frequenceTravail  = c.frequenceTravail;
    _objectifsCtrl     = TextEditingController(text: c.objectifs ?? '');
    _dateVaccinGrippe  = s?.dateVaccinGrippe;
    _dateVaccinRhino   = s?.dateVaccinRhino;
    _dateVermifuge     = s?.dateVermifuge;
    _dateMarechal      = s?.dateMarechal;
    _typeFerrure       = s?.typeFerrure;
    _dateDentiste      = s?.dateDentiste;
    _dateOsteo         = s?.dateOsteo;
    _antecedentsCtrl   = TextEditingController(text: s?.antecedents ?? '');
    _allergiesCtrl     = TextEditingController(text: s?.allergies ?? '');
    _pathologiesCtrl   = TextEditingController(text: s?.pathologies ?? '');
    _proprietaire      = g?.proprietaire;
    _demiPensionnaire  = g?.demiPensionnaire;
    _responsable       = g?.responsable;
    _ecurieCtrl        = TextEditingController(text: g?.ecurieActuelle ?? '');
    _typeLitiere       = g?.typeLitiere;

    // Auto-ouvrir la section complémentaires si au moins un champ est renseigné
    _complementairesExpanded = _hasAnyComplementaire(c, s, g);
  }

  bool _hasAnyComplementaire(Cheval c, SuiviSante? s, GestionCheval? g) {
    return c.race != null || c.robe != null || c.taille != null || c.sexe != null || c.numeroSire != null ||
        c.anneeNaissance != null || c.temperament.isNotEmpty || c.comportementTransport != null ||
        c.habitudes != null || c.sociabilite != null || c.particularitesPhysiques != null ||
        c.disciplines.isNotEmpty || c.niveauPratique != null || c.niveauTravail != null ||
        c.frequenceTravail != null || c.objectifs != null ||
        (s != null && (s.dateVaccinGrippe != null || s.dateVaccinRhino != null || s.dateVermifuge != null ||
            s.dateMarechal != null || s.dateDentiste != null || s.dateOsteo != null ||
            s.antecedents != null || s.allergies != null || s.pathologies != null)) ||
        (g != null && (g.proprietaire != null || g.demiPensionnaire != null || g.responsable != null ||
            g.ecurieActuelle != null || g.typeLitiere != null));
  }

  @override
  void dispose() {
    for (final c in [
      _nomCtrl, _raceCtrl, _robeCtrl, _anneeCtrl, _tailleCtrl, _sireCtrl,
      _particularitesCtrl, _objectifsCtrl, _antecedentsCtrl, _allergiesCtrl,
      _pathologiesCtrl, _ecurieCtrl,
    ]) { c.dispose(); }
    super.dispose();
  }

  // ── Fill counts (pour badges de complétion) ───────────────────────────────

  int get _identificationFillCount {
    int n = 0;
    if (_raceCtrl.text.trim().isNotEmpty) n++;
    if (_robeCtrl.text.trim().isNotEmpty) n++;
    if (_sexe != null) n++;
    if (_tailleCtrl.text.trim().isNotEmpty) n++;
    if (_sireCtrl.text.trim().isNotEmpty) n++;
    if (_anneeCtrl.text.trim().isNotEmpty) n++;
    return n;
  }

  int get _santeFillCount {
    int n = 0;
    if (_dateVaccinGrippe != null) n++;
    if (_dateVaccinRhino != null) n++;
    if (_dateVermifuge != null) n++;
    if (_dateMarechal != null) n++;
    if (_typeFerrure != null) n++;
    if (_dateDentiste != null) n++;
    if (_dateOsteo != null) n++;
    if (_antecedentsCtrl.text.trim().isNotEmpty) n++;
    if (_allergiesCtrl.text.trim().isNotEmpty) n++;
    if (_pathologiesCtrl.text.trim().isNotEmpty) n++;
    return n;
  }

  int get _profilFillCount {
    int n = 0;
    if (_temperament.isNotEmpty) n++;
    if (_comportementTransport != null) n++;
    if (_habitudes != null) n++;
    if (_sociabilite != null) n++;
    if (_particularitesCtrl.text.trim().isNotEmpty) n++;
    return n;
  }

  int get _sportFillCount {
    int n = 0;
    if (_disciplines.isNotEmpty) n++;
    if (_niveauPratique != null) n++;
    if (_niveauTravail != null) n++;
    if (_frequenceTravail != null) n++;
    if (_objectifsCtrl.text.trim().isNotEmpty) n++;
    return n;
  }

  int get _gestionFillCount {
    int n = 0;
    if (_ecurieCtrl.text.trim().isNotEmpty) n++;
    if (_typeLitiere != null) n++;
    return n;
  }

  int get _personnesFillCount {
    int n = 0;
    if (_proprietaire != null) n++;
    if (_demiPensionnaire != null) n++;
    if (_responsable != null) n++;
    return n;
  }

  int get _totalFillCount =>
      _identificationFillCount + _santeFillCount + _profilFillCount +
      _sportFillCount + _gestionFillCount + _personnesFillCount;

  // ── Section toggle ────────────────────────────────────────────────────────

  void _toggleSection(String key) => setState(() {
    if (_expandedSections.contains(key)) {
      _expandedSections.remove(key);
    } else {
      _expandedSections.add(key);
    }
  });

  bool _isExpanded(String key) => _expandedSections.contains(key);

  // ── Save ──────────────────────────────────────────────────────────────────

  Future<void> _sauvegarder() async {
    if (_nomCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);

    final sante = SuiviSante(
      dateVaccinGrippe: _dateVaccinGrippe,
      dateVaccinRhino:  _dateVaccinRhino,
      dateVermifuge:    _dateVermifuge,
      dateMarechal:     _dateMarechal,
      typeFerrure:      _typeFerrure,
      dateDentiste:     _dateDentiste,
      dateOsteo:        _dateOsteo,
      antecedents:  _antecedentsCtrl.text.trim().isEmpty  ? null : _antecedentsCtrl.text.trim(),
      allergies:    _allergiesCtrl.text.trim().isEmpty    ? null : _allergiesCtrl.text.trim(),
      pathologies:  _pathologiesCtrl.text.trim().isEmpty  ? null : _pathologiesCtrl.text.trim(),
    );

    final gestion = GestionCheval(
      proprietaire:     _proprietaire,
      demiPensionnaire: _demiPensionnaire,
      responsable:      _responsable,
      ecurieActuelle: _ecurieCtrl.text.trim().isEmpty ? null : _ecurieCtrl.text.trim(),
      typeLitiere: _typeLitiere,
    );

    final updated = widget.cheval.copyWith(
      nom:    _nomCtrl.text.trim(),
      type:   _type,
      race:   _raceCtrl.text.trim().isEmpty  ? null : _raceCtrl.text.trim(),
      robe:   _robeCtrl.text.trim().isEmpty  ? null : _robeCtrl.text.trim(),
      anneeNaissance: int.tryParse(_anneeCtrl.text.trim()),
      taille: _tailleCtrl.text.trim().isEmpty ? null : _tailleCtrl.text.trim(),
      numeroSire: _sireCtrl.text.trim().isEmpty ? null : _sireCtrl.text.trim(),
      sexe:   _sexe,
      temperament: _temperament.toList(),
      comportementTransport: _comportementTransport,
      habitudes: _habitudes,
      sociabilite: _sociabilite,
      particularitesPhysiques: _particularitesCtrl.text.trim().isEmpty ? null : _particularitesCtrl.text.trim(),
      disciplines: _disciplines.toList(),
      niveauPratique: _niveauPratique,
      niveauTravail: _niveauTravail,
      frequenceTravail: _frequenceTravail,
      objectifs: _objectifsCtrl.text.trim().isEmpty ? null : _objectifsCtrl.text.trim(),
      sante: sante,
      gestion: gestion,
      clearRace: _raceCtrl.text.trim().isEmpty,
      clearRobe: _robeCtrl.text.trim().isEmpty,
      clearSexe: _sexe == null,
      clearTaille: _tailleCtrl.text.trim().isEmpty,
      clearNumeroSire: _sireCtrl.text.trim().isEmpty,
      clearComportementTransport: _comportementTransport == null,
      clearHabitudes: _habitudes == null,
      clearSociabilite: _sociabilite == null,
      clearParticularites: _particularitesCtrl.text.trim().isEmpty,
      clearNiveauPratique: _niveauPratique == null,
      clearNiveauTravail: _niveauTravail == null,
      clearFrequenceTravail: _frequenceTravail == null,
      clearObjectifs: _objectifsCtrl.text.trim().isEmpty,
    );

    await ref.read(chevauxProvider.notifier).modifierCheval(updated);
    _notifierLiensNouveaux(updated);
    if (mounted) Navigator.pop(context);
  }

  void _notifierLiensNouveaux(Cheval updated) {
    // TODO: Pour chaque lien isLinked nouvellement créé → NotificationService.instance.sendLinkNotification(userId, chevalNom)
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    return Container(
          height: screenHeight * 0.88,
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            children: [
              // ── En-tête fixe ─────────────────────────────────────────────
              _SheetHeader(
                cheval: widget.cheval,
                loading: _loading,
                onSave: _sauvegarder,
              ),

              // ── Contenu scrollable ────────────────────────────────────────
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
                  children: [

                    // ── BLOC OBLIGATOIRE ──────────────────────────────────
                    _ObligatoireBloc(
                      type: _type,
                      nomCtrl: _nomCtrl,
                      onTypeChanged: (t) => setState(() => _type = t),
                    ),

                    const SizedBox(height: 20),

                    // ── INFORMATIONS COMPLÉMENTAIRES ──────────────────────
                    _ComplementairesWrapper(
                      isExpanded: _complementairesExpanded,
                      totalFill: _totalFillCount,
                      onToggle: () => setState(() => _complementairesExpanded = !_complementairesExpanded),
                      child: Column(
                        children: [

                          // 1. Identification
                          _ExpandableSection(
                            title: 'Identification',
                            icon: Icons.badge_rounded,
                            color: AppColors.primary,
                            fillCount: _identificationFillCount,
                            isExpanded: _isExpanded('identification'),
                            onToggle: () => _toggleSection('identification'),
                            child: _buildIdentification(),
                          ),
                          const SizedBox(height: 10),

                          // 2. Santé & Concours
                          _ExpandableSection(
                            title: 'Santé & Concours',
                            icon: Icons.health_and_safety_rounded,
                            color: const Color(0xFF16A34A),
                            fillCount: _santeFillCount,
                            isExpanded: _isExpanded('sante'),
                            onToggle: () => _toggleSection('sante'),
                            child: _buildSante(),
                          ),
                          const SizedBox(height: 10),

                          // 3. Profil & Comportement
                          _ExpandableSection(
                            title: 'Profil & Comportement',
                            icon: Icons.psychology_rounded,
                            color: const Color(0xFF7C3AED),
                            fillCount: _profilFillCount,
                            isExpanded: _isExpanded('profil'),
                            onToggle: () => _toggleSection('profil'),
                            child: _buildProfil(),
                          ),
                          const SizedBox(height: 10),

                          // 4. Sport & Travail
                          _ExpandableSection(
                            title: 'Sport & Travail',
                            icon: Icons.emoji_events_rounded,
                            color: AppColors.primary,
                            fillCount: _sportFillCount,
                            isExpanded: _isExpanded('sport'),
                            onToggle: () => _toggleSection('sport'),
                            child: _buildSport(),
                          ),
                          const SizedBox(height: 10),

                          // 5. Gestion & Environnement
                          _ExpandableSection(
                            title: 'Gestion & Environnement',
                            icon: Icons.home_work_rounded,
                            color: const Color(0xFF0369A1),
                            fillCount: _gestionFillCount,
                            isExpanded: _isExpanded('gestion'),
                            onToggle: () => _toggleSection('gestion'),
                            child: _buildGestion(),
                          ),
                          const SizedBox(height: 10),

                          // 6. Personnes liées
                          _ExpandableSection(
                            title: 'Personnes liées',
                            icon: Icons.people_rounded,
                            color: const Color(0xFFD97706),
                            fillCount: _personnesFillCount,
                            isExpanded: _isExpanded('personnes'),
                            onToggle: () => _toggleSection('personnes'),
                            child: _buildPersonnes(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
    );
  }

  // ── Sections content ──────────────────────────────────────────────────────

  Widget _buildIdentification() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Expanded(child: _textField(_raceCtrl, 'Race', 'ex: Selle Français')),
          const SizedBox(width: 12),
          Expanded(child: _textField(_robeCtrl, 'Robe', 'ex: Bai, Alezan…')),
        ]),
        const SizedBox(height: 14),
        const _FieldLabel('Sexe'),
        const SizedBox(height: 8),
        _ChipGroup<String>(
          options: _sexeOptions,
          selected: _sexe == null ? {} : {_sexe!},
          labelOf: (s) => s,
          color: const Color(0xFF0369A1),
          singleSelect: true,
          onToggle: (s) => setState(() => _sexe = _sexe == s ? null : s),
        ),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _textField(_anneeCtrl, 'Année de naissance', 'ex: 2016', keyboardType: TextInputType.number)),
          const SizedBox(width: 12),
          Expanded(child: _textField(_tailleCtrl, 'Taille', 'ex: 1m68')),
        ]),
        const SizedBox(height: 14),
        _textField(_sireCtrl, 'Numéro SIRE', 'ex: 01234567890A'),
      ],
    );
  }

  Widget _buildSante() {
    // Statuts vaccinaux en temps réel
    final statusGrippe = _vaccinalStatus(_dateVaccinGrippe, 180);
    final statusRhino  = _vaccinalStatus(_dateVaccinRhino, 365);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Bloc vaccins avec statut d'accès concours
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF16A34A).withOpacity(0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF16A34A).withOpacity(0.20)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Titre + indicateur accès concours
              Row(children: [
                const Icon(Icons.vaccines_rounded, size: 14, color: Color(0xFF16A34A)),
                const SizedBox(width: 6),
                const Text('Vaccination — accès concours', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
                const Spacer(),
                _AccessConcoursChip(statusGrippe: statusGrippe),
              ]),
              const SizedBox(height: 12),
              // Grippe
              _VaccinRow(
                label: 'Grippe',
                hint: 'Validité 6 mois',
                date: _dateVaccinGrippe,
                status: statusGrippe,
                onPick: (d) => setState(() => _dateVaccinGrippe = d),
              ),
              const SizedBox(height: 8),
              // Rhino
              _VaccinRow(
                label: 'Rhinopneumonie',
                hint: 'Validité 1 an',
                date: _dateVaccinRhino,
                status: statusRhino,
                onPick: (d) => setState(() => _dateVaccinRhino = d),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Suivi régulier
        const _FieldLabel('Suivi régulier'),
        const SizedBox(height: 10),
        _DateField(label: 'Dernier vermifuge', date: _dateVermifuge, onPick: (d) => setState(() => _dateVermifuge = d)),
        const SizedBox(height: 8),
        _DateField(label: 'Dernier passage maréchal', date: _dateMarechal, onPick: (d) => setState(() => _dateMarechal = d)),
        const SizedBox(height: 10),
        const _FieldLabel('Type de ferrure'),
        const SizedBox(height: 8),
        _ChipGroup<TypeFerrure>(
          options: TypeFerrure.values,
          selected: _typeFerrure == null ? {} : {_typeFerrure!},
          labelOf: (f) => f.label,
          color: const Color(0xFF7C3AED),
          singleSelect: true,
          onToggle: (f) => setState(() => _typeFerrure = _typeFerrure == f ? null : f),
        ),
        const SizedBox(height: 10),
        _DateField(label: 'Dernier dentiste', date: _dateDentiste, onPick: (d) => setState(() => _dateDentiste = d)),
        const SizedBox(height: 8),
        _DateField(label: 'Dernier ostéopathe', date: _dateOsteo, onPick: (d) => setState(() => _dateOsteo = d)),
        const SizedBox(height: 16),

        // Antécédents
        const _FieldLabel('Antécédents & alertes médicales'),
        const SizedBox(height: 8),
        _textField(_antecedentsCtrl, 'Antécédents médicaux', 'Fractures, chirurgies, blessures…', maxLines: 2),
        const SizedBox(height: 8),
        _textFieldRaw(_allergiesCtrl, 'Allergies', 'Allergies connues…', maxLines: 2, alertColor: const Color(0xFFDC2626)),
        const SizedBox(height: 8),
        _textField(_pathologiesCtrl, 'Pathologies connues', 'Fourbure, EPM, arthrose…', maxLines: 2),
      ],
    );
  }

  Widget _buildProfil() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _FieldLabel('Tempérament'),
        const SizedBox(height: 4),
        const Text('Multi-sélection possible', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
        const SizedBox(height: 8),
        _ChipGroup<Temperament>(
          options: Temperament.values,
          selected: _temperament,
          labelOf: (t) => t.label,
          color: const Color(0xFF7C3AED),
          singleSelect: false,
          onToggle: (t) => setState(() => _temperament.contains(t) ? _temperament.remove(t) : _temperament.add(t)),
        ),
        const SizedBox(height: 14),
        const _FieldLabel('Comportement au transport'),
        const SizedBox(height: 8),
        _ChipGroup<ComportementTransport>(
          options: ComportementTransport.values,
          selected: _comportementTransport == null ? {} : {_comportementTransport!},
          labelOf: (c) => c.label,
          color: const Color(0xFF0369A1),
          singleSelect: true,
          onToggle: (c) => setState(() => _comportementTransport = _comportementTransport == c ? null : c),
        ),
        const SizedBox(height: 14),
        const _FieldLabel('Habitudes de vie'),
        const SizedBox(height: 8),
        _ChipGroup<HabitudesVie>(
          options: HabitudesVie.values,
          selected: _habitudes == null ? {} : {_habitudes!},
          labelOf: (h) => h.label,
          color: const Color(0xFF16A34A),
          singleSelect: true,
          onToggle: (h) => setState(() => _habitudes = _habitudes == h ? null : h),
        ),
        const SizedBox(height: 14),
        const _FieldLabel('Sociabilité'),
        const SizedBox(height: 8),
        _ChipGroup<Sociabilite>(
          options: Sociabilite.values,
          selected: _sociabilite == null ? {} : {_sociabilite!},
          labelOf: (s) => s.label,
          color: const Color(0xFF0369A1),
          singleSelect: true,
          onToggle: (s) => setState(() => _sociabilite = _sociabilite == s ? null : s),
        ),
        const SizedBox(height: 14),
        _textField(
          _particularitesCtrl,
          'Particularités physiques',
          'Balzanes, liste, cicatrices, épi, marques distinctives…',
          maxLines: 2,
        ),
      ],
    );
  }

  Widget _buildSport() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _FieldLabel('Disciplines pratiquées'),
        const SizedBox(height: 4),
        const Text('Multi-sélection possible', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
        const SizedBox(height: 8),
        _ChipGroup<String>(
          options: _disciplinesOptions,
          selected: _disciplines,
          labelOf: (d) => d,
          color: AppColors.primary,
          singleSelect: false,
          onToggle: (d) => setState(() => _disciplines.contains(d) ? _disciplines.remove(d) : _disciplines.add(d)),
        ),
        const SizedBox(height: 14),
        const _FieldLabel('Niveau de pratique actuel'),
        const SizedBox(height: 8),
        _ChipGroup<NiveauPratique>(
          options: NiveauPratique.values,
          selected: _niveauPratique == null ? {} : {_niveauPratique!},
          labelOf: (n) => n.label,
          color: AppColors.primary,
          singleSelect: true,
          onToggle: (n) => setState(() => _niveauPratique = _niveauPratique == n ? null : n),
        ),
        const SizedBox(height: 14),
        const _FieldLabel('Niveau de travail'),
        const SizedBox(height: 8),
        _ChipGroup<NiveauTravail>(
          options: NiveauTravail.values,
          selected: _niveauTravail == null ? {} : {_niveauTravail!},
          labelOf: (n) => n.label,
          color: const Color(0xFFD97706),
          singleSelect: true,
          onToggle: (n) => setState(() => _niveauTravail = _niveauTravail == n ? null : n),
        ),
        const SizedBox(height: 14),
        const _FieldLabel('Fréquence de travail'),
        const SizedBox(height: 8),
        _ChipGroup<FrequenceTravail>(
          options: FrequenceTravail.values,
          selected: _frequenceTravail == null ? {} : {_frequenceTravail!},
          labelOf: (f) => f.label,
          color: const Color(0xFF0369A1),
          singleSelect: true,
          onToggle: (f) => setState(() => _frequenceTravail = _frequenceTravail == f ? null : f),
        ),
        const SizedBox(height: 14),
        _textField(_objectifsCtrl, 'Objectifs', 'Compétitions visées, niveau cible de la saison…', maxLines: 3),
      ],
    );
  }

  Widget _buildGestion() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _textField(_ecurieCtrl, 'Écurie actuelle', 'Nom et lieu de l\'écurie'),
        const SizedBox(height: 14),
        const _FieldLabel('Type de litière'),
        const SizedBox(height: 8),
        _ChipGroup<TypeLitiere>(
          options: TypeLitiere.values,
          selected: _typeLitiere == null ? {} : {_typeLitiere!},
          labelOf: (t) => t.label,
          color: const Color(0xFF0369A1),
          singleSelect: true,
          onToggle: (t) => setState(() => _typeLitiere = _typeLitiere == t ? null : t),
        ),
      ],
    );
  }

  Widget _buildPersonnes() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Note explicative
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFD97706).withOpacity(0.06),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFD97706).withOpacity(0.20)),
          ),
          child: const Row(
            children: [
              Icon(Icons.info_outline_rounded, size: 13, color: Color(0xFFD97706)),
              SizedBox(width: 7),
              Expanded(
                child: Text(
                  'Si la personne est déjà inscrite sur Equishow, sélectionnez-la pour créer un lien et lui envoyer une notification.',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFFD97706), height: 1.4),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _UserLinkField(
          label: 'Propriétaire',
          icon: Icons.person_rounded,
          color: AppColors.primary,
          value: _proprietaire,
          onChanged: (l) => setState(() => _proprietaire = l),
        ),
        const SizedBox(height: 12),
        _UserLinkField(
          label: 'Demi-pensionnaire',
          icon: Icons.people_rounded,
          color: const Color(0xFF7C3AED),
          value: _demiPensionnaire,
          onChanged: (l) => setState(() => _demiPensionnaire = l),
        ),
        const SizedBox(height: 12),
        _UserLinkField(
          label: 'Responsable',
          icon: Icons.manage_accounts_rounded,
          color: const Color(0xFF0369A1),
          value: _responsable,
          onChanged: (l) => setState(() => _responsable = l),
        ),
      ],
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  VaccinStatus _vaccinalStatus(DateTime? date, int validDays) {
    if (date == null) return VaccinStatus.inconnu;
    final age = DateTime.now().difference(date).inDays;
    if (age > validDays) return VaccinStatus.expire;
    if (age > validDays - 30) return VaccinStatus.expireBientot;
    return VaccinStatus.valide;
  }

  Widget _textField(TextEditingController ctrl, String label, String hint, {TextInputType? keyboardType, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _FieldLabel(label),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          maxLines: maxLines,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(hintText: hint),
        ),
      ],
    );
  }

  Widget _textFieldRaw(TextEditingController ctrl, String label, String hint, {TextInputType? keyboardType, int maxLines = 1, Color? alertColor}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          if (alertColor != null) Icon(Icons.warning_rounded, size: 12, color: alertColor),
          if (alertColor != null) const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: alertColor ?? AppColors.textPrimary)),
        ]),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          maxLines: maxLines,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(
            hintText: hint,
            focusedBorder: alertColor != null ? OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: alertColor),
            ) : null,
          ),
        ),
      ],
    );
  }
}

// ── Sheet header ──────────────────────────────────────────────────────────────

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.cheval, required this.loading, required this.onSave});
  final Cheval cheval;
  final bool loading;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 14),
      child: Column(
        children: [
          // Grab handle
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(color: AppColors.borderMedium, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Modifier la fiche', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    Text(cheval.nom, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: loading ? null : onSave,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: loading
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Enregistrer', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Bloc obligatoire ──────────────────────────────────────────────────────────

class _ObligatoireBloc extends StatelessWidget {
  const _ObligatoireBloc({required this.type, required this.nomCtrl, required this.onTypeChanged});
  final TypeCheval type;
  final TextEditingController nomCtrl;
  final ValueChanged<TypeCheval> onTypeChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primaryBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label section
          Row(children: [
            Container(
              width: 24, height: 24,
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(6)),
              child: const Icon(Icons.star_rounded, size: 13, color: Colors.white),
            ),
            const SizedBox(width: 8),
            const Text('Informations obligatoires', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
          ]),
          const SizedBox(height: 16),

          // Type Cheval / Poney
          const Text('Type *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          Row(
            children: TypeCheval.values.map((t) {
              final isSelected = type == t;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: t != TypeCheval.values.last ? 12 : 0),
                  child: GestureDetector(
                    onTap: () => onTypeChanged(t),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isSelected ? AppColors.primary : AppColors.borderMedium, width: 1.5),
                        boxShadow: isSelected ? [BoxShadow(color: AppColors.primary.withOpacity(0.25), blurRadius: 6, offset: const Offset(0, 2))] : null,
                      ),
                      child: Column(
                        children: [
                          Text(t.emoji, style: const TextStyle(fontSize: 22)),
                          const SizedBox(height: 3),
                          Text(
                            t.label,
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isSelected ? Colors.white : AppColors.textPrimary),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),

          // Nom
          const Text('Nom *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          TextField(
            controller: nomCtrl,
            textCapitalization: TextCapitalization.words,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            decoration: const InputDecoration(
              hintText: 'Nom du cheval',
              prefixIcon: Icon(Icons.local_florist_rounded),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Wrapper "Informations complémentaires" ────────────────────────────────────

class _ComplementairesWrapper extends StatelessWidget {
  const _ComplementairesWrapper({
    required this.isExpanded,
    required this.totalFill,
    required this.onToggle,
    required this.child,
  });
  final bool isExpanded;
  final int totalFill;
  final VoidCallback onToggle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isExpanded ? AppColors.borderMedium : AppColors.border),
      ),
      child: Column(
        children: [
          // Header principal — clic pour ouvrir/fermer tout
          Semantics(
            button: true,
            label: 'Informations complémentaires',
            child: InkWell(
              onTap: onToggle,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Container(
                      width: 34, height: 34,
                      decoration: BoxDecoration(
                        color: AppColors.textPrimary.withOpacity(0.07),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: const Icon(Icons.tune_rounded, size: 18, color: AppColors.textPrimary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Informations complémentaires', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                          Text(
                            totalFill > 0 ? '$totalFill champ${totalFill > 1 ? "s" : ""} renseigné${totalFill > 1 ? "s" : ""}' : 'Identification, santé, sport, gestion…',
                            style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    if (totalFill > 0)
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text('$totalFill', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      ),
                    AnimatedRotation(
                      turns: isExpanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(Icons.keyboard_arrow_down_rounded, size: 24, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Contenu animé
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
              child: Column(
                children: [
                  const Divider(height: 1, color: AppColors.border),
                  const SizedBox(height: 12),
                  child,
                ],
              ),
            ),
            crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
      ),
    );
  }
}

// ── Section dépliable individuelle ────────────────────────────────────────────

class _ExpandableSection extends StatelessWidget {
  const _ExpandableSection({
    required this.title,
    required this.icon,
    required this.color,
    required this.fillCount,
    required this.isExpanded,
    required this.onToggle,
    required this.child,
  });
  final String title;
  final IconData icon;
  final Color color;
  final int fillCount;
  final bool isExpanded;
  final VoidCallback onToggle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isExpanded ? color.withOpacity(0.30) : AppColors.borderMedium),
      ),
      child: Column(
        children: [
          // Header
          Semantics(
            button: true,
            label: title,
            child: InkWell(
              onTap: onToggle,
              borderRadius: BorderRadius.circular(14),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(7)),
                      child: Icon(icon, size: 15, color: color),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    ),
                    if (fillCount > 0)
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$fillCount',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
                        ),
                      ),
                    AnimatedRotation(
                      turns: isExpanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: Icon(Icons.keyboard_arrow_down_rounded, color: color, size: 20),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Contenu
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(height: 1, color: AppColors.border),
                  const SizedBox(height: 14),
                  child,
                ],
              ),
            ),
            crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 220),
          ),
        ],
      ),
    );
  }
}

// ── Vaccin row avec statut temps réel ─────────────────────────────────────────

class _VaccinRow extends StatelessWidget {
  const _VaccinRow({required this.label, required this.hint, required this.date, required this.status, required this.onPick});
  final String label;
  final String hint;
  final DateTime? date;
  final VaccinStatus status;
  final ValueChanged<DateTime?> onPick;

  @override
  Widget build(BuildContext context) {
    final (color, dot) = switch (status) {
      VaccinStatus.valide        => (const Color(0xFF16A34A), '🟢'),
      VaccinStatus.expireBientot => (const Color(0xFFD97706), '🟡'),
      VaccinStatus.expire        => (const Color(0xFFDC2626), '🔴'),
      VaccinStatus.inconnu       => (AppColors.textTertiary,  '⚪'),
    };

    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date ?? DateTime.now(),
          firstDate: DateTime(2015),
          lastDate: DateTime.now(),
          locale: const Locale('fr'),
        );
        if (picked != null) onPick(picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: date != null ? color.withOpacity(0.4) : AppColors.borderMedium),
        ),
        child: Row(
          children: [
            Text(dot, style: const TextStyle(fontSize: 13)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: date != null ? color : AppColors.textSecondary)),
                  Text(hint, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
                ],
              ),
            ),
            Text(
              date != null ? DateFormat('d MMM yyyy', 'fr').format(date!) : 'Saisir la date',
              style: TextStyle(fontSize: 12, fontWeight: date != null ? FontWeight.w700 : FontWeight.w400, color: date != null ? color : AppColors.textTertiary),
            ),
            if (date != null) ...[
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () => onPick(null),
                child: const Icon(Icons.close_rounded, size: 14, color: AppColors.textTertiary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Chip accès concours ───────────────────────────────────────────────────────

class _AccessConcoursChip extends StatelessWidget {
  const _AccessConcoursChip({required this.statusGrippe});
  final VaccinStatus statusGrippe;

  @override
  Widget build(BuildContext context) {
    final (label, color, bg) = switch (statusGrippe) {
      VaccinStatus.valide        => ('Accès OK', const Color(0xFF16A34A), const Color(0xFFF0FDF4)),
      VaccinStatus.expireBientot => ('Expire bientôt', const Color(0xFFD97706), const Color(0xFFFFFBEB)),
      VaccinStatus.expire        => ('Accès refusé', const Color(0xFFDC2626), const Color(0xFFFEF2F2)),
      VaccinStatus.inconnu       => ('Non renseigné', AppColors.textTertiary, AppColors.background),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20), border: Border.all(color: color.withOpacity(0.30))),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

// ── Chip group générique ──────────────────────────────────────────────────────

class _ChipGroup<T> extends StatelessWidget {
  const _ChipGroup({
    required this.options,
    required this.selected,
    required this.labelOf,
    required this.color,
    required this.singleSelect,
    required this.onToggle,
  });
  final List<T> options;
  final Set<T> selected;
  final String Function(T) labelOf;
  final Color color;
  final bool singleSelect;
  final void Function(T) onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((o) {
        final isSelected = selected.contains(o);
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onToggle(o),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected ? color.withOpacity(0.12) : AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: isSelected ? color : AppColors.borderMedium, width: 1.5),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isSelected) ...[
                  Icon(Icons.check_rounded, size: 12, color: color),
                  const SizedBox(width: 4),
                ],
                Text(
                  labelOf(o),
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? color : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ── Date field ────────────────────────────────────────────────────────────────

class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.date, required this.onPick});
  final String label;
  final DateTime? date;
  final ValueChanged<DateTime?> onPick;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: GestureDetector(
        onTap: () async {
          final picked = await showDatePicker(
            context: context,
            initialDate: date ?? DateTime.now(),
            firstDate: DateTime(2000),
            lastDate: DateTime.now(),
            locale: const Locale('fr'),
          );
          if (picked != null) onPick(picked);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: date != null ? AppColors.primary.withOpacity(0.40) : AppColors.borderMedium),
          ),
          child: Row(
            children: [
              Icon(Icons.calendar_today_rounded, size: 15, color: date != null ? AppColors.primary : AppColors.textTertiary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  date != null ? DateFormat('d MMMM yyyy', 'fr').format(date!) : label,
                  style: TextStyle(
                    fontSize: 13,
                    color: date != null ? AppColors.textPrimary : AppColors.textTertiary,
                    fontWeight: date != null ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              if (date != null)
                GestureDetector(
                  onTap: () => onPick(null),
                  child: const Icon(Icons.close_rounded, size: 15, color: AppColors.textTertiary),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── User link field ───────────────────────────────────────────────────────────

class _UserLinkField extends StatefulWidget {
  const _UserLinkField({
    required this.label,
    required this.icon,
    required this.color,
    required this.value,
    required this.onChanged,
  });
  final String label;
  final IconData icon;
  final Color color;
  final LienUtilisateur? value;
  final ValueChanged<LienUtilisateur?> onChanged;

  @override
  State<_UserLinkField> createState() => _UserLinkFieldState();
}

class _UserLinkFieldState extends State<_UserLinkField> {
  bool _editing = false;
  final _searchCtrl = TextEditingController();
  List<LienUtilisateur> _suggestions = [];

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  void _onSearch(String query) {
    if (query.trim().isEmpty) { setState(() => _suggestions = []); return; }
    final q = query.toLowerCase();
    setState(() {
      _suggestions = mockAppUsers
          .where((u) => u.nom.toLowerCase().contains(q) || (u.email?.toLowerCase().contains(q) ?? false))
          .toList();
    });
  }

  void _selectUser(LienUtilisateur user) {
    widget.onChanged(user);
    setState(() { _editing = false; _suggestions = []; _searchCtrl.clear(); });
    // TODO: NotificationService.instance.sendLinkNotification(user.userId!, chevalNom)
  }

  void _confirmManual() {
    final nom = _searchCtrl.text.trim();
    if (nom.isEmpty) return;
    widget.onChanged(LienUtilisateur(nom: nom));
    setState(() { _editing = false; _suggestions = []; _searchCtrl.clear(); });
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Row(children: [
          Icon(widget.icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(widget.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        ]),
        const SizedBox(height: 8),

        if (!_editing && widget.value != null)
          // ── État renseigné ──────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withOpacity(0.30)),
            ),
            child: Row(
              children: [
                Container(
                  width: 34, height: 34,
                  decoration: BoxDecoration(
                    color: (widget.value!.avatarColor ?? color).withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      widget.value!.displayInitiales,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: widget.value!.avatarColor ?? color),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Text(widget.value!.nom, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        if (widget.value!.isLinked) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFF16A34A).withOpacity(0.12), borderRadius: BorderRadius.circular(4)),
                            child: const Text('Lié ✓', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
                          ),
                        ],
                      ]),
                      if (widget.value!.email != null)
                        Text(widget.value!.email!, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.edit_rounded, size: 16, color: color),
                  onPressed: () => setState(() => _editing = true),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 16, color: AppColors.textTertiary),
                  onPressed: () { widget.onChanged(null); setState(() {}); },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
              ],
            ),
          )

        else if (!_editing)
          // ── État vide ───────────────────────────────────────────────────
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _editing = true),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.borderMedium),
              ),
              child: Row(
                children: [
                  Icon(Icons.add_rounded, size: 16, color: color),
                  const SizedBox(width: 8),
                  Text('Ajouter ${widget.label.toLowerCase()}', style: const TextStyle(fontSize: 13, color: AppColors.textTertiary)),
                ],
              ),
            ),
          )

        else ...[
          // ── Mode recherche ──────────────────────────────────────────────
          TextField(
            controller: _searchCtrl,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Rechercher par nom ou email…',
              prefixIcon: Icon(Icons.search_rounded, size: 18, color: color),
              suffixIcon: IconButton(
                icon: const Icon(Icons.close_rounded, size: 16),
                onPressed: () => setState(() { _editing = false; _searchCtrl.clear(); _suggestions = []; }),
              ),
            ),
            onChanged: _onSearch,
          ),
          // Résultats utilisateurs Equishow
          if (_suggestions.isNotEmpty) ...[
            const SizedBox(height: 4),
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2))],
              ),
              child: Column(
                children: _suggestions.map((u) => InkWell(
                  onTap: () => _selectUser(u),
                  borderRadius: BorderRadius.circular(10),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 32, height: 32,
                          decoration: BoxDecoration(color: (u.avatarColor ?? color).withOpacity(0.15), shape: BoxShape.circle),
                          child: Center(child: Text(u.displayInitiales, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: u.avatarColor ?? color))),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(u.nom, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                              if (u.email != null)
                                Text(u.email!, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(color: const Color(0xFF16A34A).withOpacity(0.10), borderRadius: BorderRadius.circular(5)),
                          child: const Text('Sur Equishow', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
                        ),
                      ],
                    ),
                  ),
                )).toList(),
              ),
            ),
          ],
          // Ajout manuel si pas de résultat
          if (_searchCtrl.text.trim().isNotEmpty && _suggestions.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _confirmManual,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: color.withOpacity(0.20)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.person_add_rounded, size: 16, color: color),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Ajouter "${_searchCtrl.text.trim()}" (non inscrit)',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

// ── Field label ───────────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
  );
}
