#!/usr/bin/env bash
# ==============================================================================
# Stage 1 Post-Deployment Security & Correctness Smoke Test Suite
# Usage:
#   BASE_URL="https://your-deployed-site.vercel.app" \
#   SUPABASE_URL="https://xyz.supabase.co" \
#   SUPABASE_PUBLISHABLE_KEY="sb_publishable_..." \
#   ./verify-stage1-deployment.sh
# ==============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"

PASS=0
FAIL=0

check_status() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "[PASS] $name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name — expected HTTP $expected, got HTTP $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo "Running Stage 1 Post-Deployment Verification against: $BASE_URL"
echo ""

# 1. Health & Durable Database Check
HEALTH_JSON=$(curl -sS "$BASE_URL/api/health" || echo "{}")
echo "1. Health response: $HEALTH_JSON"
if echo "$HEALTH_JSON" | grep -q '"supabase":"connected"'; then
  echo "[PASS] Production database is connected to Supabase (not local /tmp fallback)"
  PASS=$((PASS + 1))
else
  echo "[WARN] Supabase not reported as connected in /api/health — verify SUPABASE_URL & SUPABASE_SECRET_KEY in Vercel"
fi

if echo "$HEALTH_JSON" | grep -q '"jwtSecret":"configured"'; then
  echo "[PASS] Production JWT_SECRET is configured"
  PASS=$((PASS + 1))
else
  echo "[FAIL] JWT_SECRET not reported as configured in /api/health — set a strong random JWT_SECRET in Vercel"
  FAIL=$((FAIL + 1))
fi

# 2. Reject dev-fallback-token on /api/auth/me
STATUS_DEMO_ME=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer dev-fallback-token" \
  "$BASE_URL/api/auth/me")
check_status "Reject dev-fallback-token on GET /api/auth/me" "401" "$STATUS_DEMO_ME"

# 3. Reject legacy-app-password-token on /api/exams
STATUS_LEGACY_EXAMS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer legacy-app-password-token" \
  "$BASE_URL/api/exams")
check_status "Reject legacy-app-password-token on GET /api/exams" "401" "$STATUS_LEGACY_EXAMS"

# 4. Reject hardcoded dlp_teacher_secret_passcode_2026 on teacher signup
STATUS_DEFAULT_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"audit_probe@example.com","password":"Password123!","fullName":"Probe","accessCode":"dlp_teacher_secret_passcode_2026"}')
check_status "Reject hardcoded default passcode on POST /api/auth/signup" "401" "$STATUS_DEFAULT_CODE"

# 5. Reject demo submission flag in production on POST /api/submissions
STATUS_DEMO_SUB=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/submissions" \
  -H "Content-Type: application/json" \
  -d '{"examId":"exam_default","isDevDemo":true,"studentName":"Demo Probe","studentAnswers":{}}')
check_status "Reject isDevDemo submission in production on POST /api/submissions" "403" "$STATUS_DEMO_SUB"

# 6. Reject unresolved/bogus examId (must return 404, never attach to newest active exam)
STATUS_BOGUS_EXAM=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/submissions" \
  -H "Content-Type: application/json" \
  -d '{"examId":"exam_does_not_exist_999999","studentName":"Probe","studentAnswers":{"q1":0}}')
check_status "Reject non-existent examId with 404 (no silent reassignment)" "404" "$STATUS_BOGUS_EXAM"

# 7. Reject unauthenticated POST /api/student-auth/join-class
STATUS_JOIN_UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/student-auth/join-class" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"stu_probe","classCode":"CLASS-DEMO26"}')
check_status "Reject unauthenticated POST /api/student-auth/join-class" "401" "$STATUS_JOIN_UNAUTH"

# 8. Reject forged default-secret student JWT on GET /api/student/me
FORGED_DEFAULT_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiJzdHVfcHJvYmUiLCJyb2xlIjoic3R1ZGVudCJ9.M0CvR7ORB2vW5gQ5gsSd0FKewgo3zC7_vmaxnSvCDuo"
STATUS_FORGED_STU=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $FORGED_DEFAULT_JWT" \
  "$BASE_URL/api/student/me")
if [[ "$STATUS_FORGED_STU" == "403" ]]; then
  echo "[PASS] Reject forged student JWT on GET /api/student/me (HTTP 403)"
  PASS=$((PASS + 1))
else
  echo "[FAIL] Forged default-secret student JWT check expected HTTP 403, got HTTP $STATUS_FORGED_STU"
  FAIL=$((FAIL + 1))
fi

# 9. Optional Direct Supabase PostgREST RLS Verification (if SUPABASE_URL & SUPABASE_PUBLISHABLE_KEY provided)
if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_PUBLISHABLE_KEY" ]]; then
  echo ""
  echo "Testing direct PostgREST anonymous access with SUPABASE_PUBLISHABLE_KEY..."
  STUDENTS_RESP=$(curl -s -w "\n%{http_code}" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" \
    "$SUPABASE_URL/rest/v1/students?select=*")
  STUDENTS_BODY=$(echo "$STUDENTS_RESP" | head -n -1)
  STUDENTS_CODE=$(echo "$STUDENTS_RESP" | tail -n 1)

  if [[ "$STUDENTS_CODE" == "401" || "$STUDENTS_CODE" == "403" || "$STUDENTS_BODY" == "[]" ]]; then
    echo "[PASS] Anonymous PostgREST query to /rest/v1/students blocked or empty (HTTP $STUDENTS_CODE)"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] Anonymous PostgREST query to /rest/v1/students returned data! Run server/db/migration_student_auth.sql in Supabase SQL Editor."
    FAIL=$((FAIL + 1))
  fi
fi

echo ""
echo "Summary: $PASS passed, $FAIL failed."
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
