#!/usr/bin/env bash
# Static checks for Firestore rules that back the Judicial lens and locked roles.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RULES="$ROOT/firestore.rules"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -f "$RULES" ]] || fail "firestore.rules not found"

grep -q 'function isJudicial' "$RULES" || fail "isJudicial helper missing"
grep -q 'function isAssigner' "$RULES" || fail "isAssigner helper missing"

grep -q "('judicial' in resource.data.roles) == ('judicial' in request.resource.data.roles)" "$RULES" \
  || fail "self-patch must not grant or revoke judicial"

grep -q "!('judicial' in request.resource.data.roles)" "$RULES" \
  || fail "self-join must not grant judicial"

grep -q 'isJudicial(orgId)' "$RULES" || fail "cardReports / cases must authorize judicial"

grep -q 'match /judicialCases/{caseId}' "$RULES" || fail "judicialCases collection missing"
grep -q 'match /comments/{commentId}' "$RULES" || fail "judicial case comments missing"
grep -q 'match /judicialSettings/{docId}' "$RULES" || fail "judicialSettings missing"
grep -q "request.resource.data.authorUid == request.auth.uid" "$RULES" \
  || fail "comment create must bind authorUid"

grep -q "allow update, delete: if false;" "$RULES" \
  || fail "comments must be append-only (no client update/delete)"

grep -q "request.resource.data.status in \['recorded', 'pending'\]" "$RULES" \
  || fail "MO case create must be recorded or pending only"

grep -q 'match /adminRateLimits/{limitId}' "$RULES" \
  || fail "adminRateLimits must deny client access"

echo "OK: firestore.rules Judicial + locked-role checks passed"
