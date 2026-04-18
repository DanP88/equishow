# Code Review Skill

## Description
Ce skill analyse le codebase Equishow et génère un rapport détaillé de tous les problèmes, bugs, et améliorations possibles.

## Usage

### Méthode 1: Exécuter le script
```bash
chmod +x .claude/skills/code-review.sh
./.claude/skills/code-review.sh
```

### Méthode 2: Demander une revue à Claude
Demande simplement: **"Fais une revue complète du code"** ou **"/code-review"**

## Rapport Généré

Le script génère un rapport dans `.claude/issues/` avec les sections suivantes :

### 1. **TypeScript Errors & Warnings**
- Utilisation de `any` type (à éviter)
- Variables inutilisées
- Imports non utilisés

### 2. **Code Quality Issues**
- Fonctions trop longues (>100 lignes)
- Code dupliqué
- Imports mal organisés
- Manque d'error handling

### 3. **Security Issues**
- Secrets hardcodés
- Validation d'entrée manquante
- RLS policies incomplets
- Authentification faible

### 4. **Performance Issues**
- Requêtes N+1
- Re-renders inutiles
- Manque de memoization
- Bundle size issues

### 5. **Type Safety Issues**
- Type annotations manquantes
- Any types à remplacer
- Interfaces incomplètes

### 6. **Dependencies Issues**
- Versions incompatibles
- Packages inutilisés
- Mises à jour de sécurité

## Rapport Récents

Les rapports générés sont stockés dans `.claude/issues/` :
```
.claude/issues/
├── code-review-20260413-150230.md
├── code-review-20260413-120145.md
└── ...
```

## Priorités de Correction

### 🔴 Critique
- Failles de sécurité
- Secrets exposés
- RLS policies manquantes

### 🟠 Haute
- TypeScript errors
- Performance critiques
- Type safety issues

### 🟡 Moyen
- Code quality
- Error handling
- Memoization

### 🟢 Basse
- Style improvements
- Documentation
- Refactoring

## Intégration avec Claude Code

Le skill s'intègre automatiquement avec Claude Code. Tu peux :

1. **Demander une revue spécifique**
   - "Review la page reserver-coach.tsx"
   - "Trouve tous les bugs de sécurité"
   - "Cherche les performance issues"

2. **Corriger les problèmes trouvés**
   - Claude proposera des fixes basés sur le rapport
   - Les changements seront appliqués automatiquement

3. **Générer un rapport complet**
   - "Fais une revue complète du projet"
   - Le rapport sera sauvegardé pour référence

## Limitations

- Le script utilise des regex de base (pas d'AST parsing)
- Certains problèmes nécessitent une analyse humaine
- Les faux positifs peuvent arriver
- Le rapport doit être validé manuellement

## Améliorations Futures

- [ ] Intégration avec ESLint/TypeScript compiler
- [ ] Détection automatique de patterns dangereux
- [ ] Suggestions de refactoring basées sur AST
- [ ] Comparaison avec rapports antérieurs
- [ ] Génération de tickets GitHub

## Exemples de Problèmes Détectés

### Exemple 1: `any` Type
```typescript
// ❌ Détecté
const data: any = response.data;

// ✅ Recommandé
const data: CoachProfil = response.data;
```

### Exemple 2: Variable Inutilisée
```typescript
// ❌ Détecté
const _unused = data.value;

// ✅ Recommandé
// Supprimer la variable
```

### Exemple 3: Erreur Non Gérée
```typescript
// ❌ Détecté
const response = await fetch(url);
const data = response.json();

// ✅ Recommandé
try {
  const response = await fetch(url);
  const data = await response.json();
  return data;
} catch (error) {
  console.error('Error:', error);
  throw error;
}
```

## Contacts & Support

- Pour améliorer le skill: modifiez `.claude/skills/code-review.sh`
- Pour questions: consultez le rapport généré
- Pour corrections: exécutez le skill régulièrement

---

**Dernière mise à jour**: 2026-04-13
**Skill Version**: 1.0
**Status**: ✅ Active
