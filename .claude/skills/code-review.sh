#!/bin/bash

# Equishow Code Review Skill
# Analyse le code et documente les problèmes/bugs

OUTPUT_DIR=".claude/issues"
mkdir -p "$OUTPUT_DIR"

REPORT_FILE="$OUTPUT_DIR/code-review-$(date +%Y%m%d-%H%M%S).md"

echo "# Code Review Report" > "$REPORT_FILE"
echo "**Generated**: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "## 1. TypeScript Errors & Warnings"
echo "Searching for TypeScript issues..." >&2
echo "" >> "$REPORT_FILE"
echo "### TypeScript Issues" >> "$REPORT_FILE"

# Chercher les erreurs TypeScript
find expo_app -name "*.tsx" -o -name "*.ts" | while read file; do
  # Chercher les 'any' types
  grep -n "any" "$file" 2>/dev/null | grep -v "anyOf" | head -5 | while read line; do
    echo "- **$file**: \`any\` type found: $line" >> "$REPORT_FILE"
  done
done

echo "" >> "$REPORT_FILE"
echo "### Unused Variables" >> "$REPORT_FILE"

# Chercher les variables inutilisées
find expo_app -name "*.tsx" -o -name "*.ts" | while read file; do
  grep -n "_[a-zA-Z]* =" "$file" 2>/dev/null | head -3 | while read line; do
    echo "- **$file**: Possible unused var: $line" >> "$REPORT_FILE"
  done
done

echo "" >> "$REPORT_FILE"
echo "## 2. Code Quality Issues" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Long Functions (>100 lines)" >> "$REPORT_FILE"
find expo_app -name "*.tsx" -o -name "*.ts" | while read file; do
  wc -l "$file" | awk -v fname="$file" '$1 > 100 { print "- **" fname "**: " $1 " lines" }' >> "$REPORT_FILE" 2>/dev/null
done

echo "" >> "$REPORT_FILE"
echo "### Missing Error Handling" >> "$REPORT_FILE"

# Chercher les try/catch manquants
grep -r "async\|fetch\|\.get(\|\.post(" expo_app/app --include="*.tsx" --include="*.ts" | grep -v "try\|catch" | head -5 | while read line; do
  echo "- $line" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "## 3. Security Issues" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Potential Secrets in Code" >> "$REPORT_FILE"
grep -r "password\|secret\|api_key\|token" expo_app/app --include="*.tsx" --include="*.ts" -i | grep -v "// \|/\* \|const.*=\|type\|interface" | head -5 | while read line; do
  echo "- $line" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "### Missing RLS Checks" >> "$REPORT_FILE"
grep -r "supabase.from\|select(\|insert(\|update(" expo_app --include="*.tsx" --include="*.ts" | grep -v "rls\|where\|auth" | head -5 | while read line; do
  echo "- Check RLS policy: $line" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "## 4. Performance Issues" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Potential N+1 Queries" >> "$REPORT_FILE"
grep -rn "\.map\|\.forEach" expo_app/app --include="*.tsx" | grep -i "fetch\|supabase\|from\|query" | head -5 | while read line; do
  echo "- $line" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "### Missing Memoization" >> "$REPORT_FILE"
grep -rn "useCallback\|useMemo\|memo" expo_app/app --include="*.tsx" | wc -l | awk '{ print "- Only " $1 " memoizations found" }' >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "## 5. Type Safety Issues" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Missing Type Annotations" >> "$REPORT_FILE"
grep -rn "function.*{" expo_app/app --include="*.tsx" | grep -v ": " | head -5 | while read line; do
  echo "- $line" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "## 6. Dependencies Issues" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Vérifier les versions incompatibles
echo "### Version Mismatches" >> "$REPORT_FILE"
echo "- See package.json for version warnings during npm start" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "**Review Date**: $(date)" >> "$REPORT_FILE"
echo "**Reviewer**: Claude Code" >> "$REPORT_FILE"

echo "✅ Code review report saved to: $REPORT_FILE"
cat "$REPORT_FILE"
