# Claude Code Skills for Equishow

Collection de skills personnalisés pour améliorer la qualité et la productivité du développement Equishow.

## 📦 Skills Disponibles

### 1. **Code Review Skill** 🔍
Analyse complète du codebase pour détecter les problèmes, bugs, et améliorations.

**Usage:**
```bash
./.claude/skills/code-review.sh
```

**Output:** Rapport sauvegardé dans `.claude/issues/code-review-YYYYMMDD-HHMMSS.md`

**Analyse:**
- ✅ TypeScript errors & warnings
- ✅ Code quality issues
- ✅ Security issues
- ✅ Performance issues
- ✅ Type safety issues
- ✅ Dependencies issues

[Voir la documentation complète](./CODE_REVIEW.md)

---

## 🚀 Quick Start

### Exécuter une revue de code
```bash
cd /Users/dan/equishow
./.claude/skills/code-review.sh
```

### Consulter les rapports
```bash
ls -la .claude/issues/
# Lire le rapport le plus récent
cat .claude/issues/code-review-*.md | head -200
```

---

## 📊 Rapports Générés

Les rapports sont stockés dans `.claude/issues/` :

| Date | File | Size | Status |
|------|------|------|--------|
| 2026-04-13 | code-review-20260413-181317.md | 2.9 MB | ✅ Generated |

### Derniers Problèmes Trouvés

**🔴 Critique:**
- [ ] Vérifier les `any` types en router.push() - potential routing issues
- [ ] Valider les RLS policies manquantes

**🟠 Haute Priorité:**
- [ ] 30+ instances de `any` type à remplacer par les vrais types
- [ ] Améliorer le type safety dans les pages de réservation

**🟡 Moyen:**
- [ ] Ajouter plus de error handling
- [ ] Optimiser les memoizations

---

## 🎯 Intégration Claude

### Demander une revue de code
```
Claude, fais une revue complète du code
```

### Demander un fix spécifique
```
Claude, corrige tous les `any` types dans reserver-coach.tsx
```

### Générer un rapport
```
Claude, génère un rapport de code review
```

---

## 📝 Créer Vos Propres Skills

### Structure
```
.claude/skills/
├── README.md              # Ce fichier
├── CODE_REVIEW.md         # Documentation du skill
├── code-review.sh         # Script principal
└── your-skill.sh          # Vos skills personnalisés
```

### Template
```bash
#!/bin/bash
# Description
# Usage

OUTPUT_DIR=".claude/issues"
mkdir -p "$OUTPUT_DIR"
REPORT_FILE="$OUTPUT_DIR/your-skill-$(date +%Y%m%d-%H%M%S).md"

echo "# Your Skill Report" > "$REPORT_FILE"
echo "**Generated**: $(date)" >> "$REPORT_FILE"

# Your analysis here

echo "✅ Report saved to: $REPORT_FILE"
cat "$REPORT_FILE"
```

---

## 🔧 Maintenance

### Mettre à jour un skill
1. Modifiez le fichier `.claude/skills/xxx.sh`
2. Testez manuellement
3. Validez les changements

### Créer un nouveau skill
1. Créez `your-skill.sh` dans `.claude/skills/`
2. Écrivez la documentation dans `your-skill.md`
3. Testez le script
4. Ajoutez une entrée dans ce README

---

## 📋 Checklist de Revue

Utilise ces points pour valider les changements:

- [ ] Pas de `any` type dans le code source
- [ ] Toutes les routes sont typées correctement
- [ ] RLS policies sont définies sur les tables
- [ ] Error handling sur les API calls
- [ ] Memoization sur les composants coûteux
- [ ] Pas de secrets exposés
- [ ] Pas de N+1 queries
- [ ] Tests écrits pour les changements

---

## 🤝 Support

Pour améliorer les skills:
1. Identifiez le problème
2. Mettez à jour le script
3. Testez le changement
4. Commitez les améliorations

---

## 📅 Historique

| Date | Skill | Action |
|------|-------|--------|
| 2026-04-13 | code-review | ✅ Created |
| 2026-04-13 | - | Initial setup |

---

**Last Updated**: 2026-04-13 18:15
**Status**: ✅ Active
