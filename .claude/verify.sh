#!/usr/bin/env bash
# Pre-push verifier. With the app present, run the full checks. A docs-only
# tree (README/LICENSE/NOTICE) has nothing to build, so it only checks that
# no code slipped in unverified.
set -euo pipefail
if [ -f package.json ]; then
  npm run lint
  npm run typecheck
  npm test
  npm run build
  exit 0
fi
extra=$(git ls-files | grep -vE '^(README\.md|LICENSE|NOTICE|\.gitignore|\.claude/verify\.sh)$' || true)
if [ -n "$extra" ]; then
  echo "verify: code without package.json, nothing to run it with:" >&2
  echo "$extra" >&2
  exit 1
fi
echo "verify: docs-only tree, nothing to build."
