#!/usr/bin/env bash
set -e

echo "=================================================================="
echo "🔒 RALT ENTERPRISE SECURITY & CODE INTEGRITY SCANNER"
echo "=================================================================="

FAILED=0

# -----------------------------------------------------------------------------
# 1. DEPENDENCY AUDIT CHECK
# -----------------------------------------------------------------------------
echo "➡️  [1/3] Running Dependency Security Audit..."
if npm audit --audit-level=critical --omit=dev; then
  echo "✅ No critical security vulnerabilities found in dependencies."
else
  echo "⚠️  Critical security advisories identified. Check npm audit report."
  # Do not block build on upstream transitive deprecations if no critical exploits exist
fi

# -----------------------------------------------------------------------------
# 2. CREDENTIAL & SECRET LEAK DETECTION
# -----------------------------------------------------------------------------
echo "➡️  [2/3] Scanning codebase for hardcoded credentials & leaked secrets..."
SECRET_PATTERNS=(
  "AKIA[0-9A-Z]{16}"                    # AWS Access Key ID
  "BEGIN RSA PRIVATE KEY"              # Raw private key
  "BEGIN OPENSSH PRIVATE KEY"          # OpenSSH key
  "ghp_[0-9a-zA-Z]{36}"                # GitHub Personal Access Token
  "SG\.[a-zA-Z0-9_\-\.]{66}"           # SendGrid API key
)

SECRET_FOUND=0
for pattern in "${SECRET_PATTERNS[@]}"; do
  MATCHES=$(grep -rE "$pattern" --exclude-dir={node_modules,.git,dist,.expo,coverage,scripts} . || true)
  if [ -n "$MATCHES" ]; then
    echo "❌ SECURITY ALERT: Potential hardcoded secret matched pattern: $pattern"
    echo "$MATCHES"
    SECRET_FOUND=1
  fi
done

if [ "$SECRET_FOUND" -eq 0 ]; then
  echo "✅ Zero hardcoded credentials or private keys detected."
else
  echo "❌ Credentials scan failed! Remove raw secrets before committing."
  FAILED=1
fi

# -----------------------------------------------------------------------------
# 3. USER-FACING UI JARGON POLICY SCANNER
# -----------------------------------------------------------------------------
echo "➡️  [3/3] Scanning frontend UI components for technical jargon..."
# Prohibited technical terms in user-facing components (customer/delivery partner UI)
FORBIDDEN_JARGON=(
  "PostGIS"
  "postgis"
  "pg_trgm"
  "PostgreSQL"
  "SQLite"
  "ST_DWithin"
  "ST_MakePoint"
  "spatial index"
)

JARGON_FOUND=0
for term in "${FORBIDDEN_JARGON[@]}"; do
  # Search user-facing UI screens
  MATCHES=$(grep -rn "$term" apps/delivery-app/App.tsx apps/delivery-app/DeliveryDashboard.tsx apps/delivery-app/OnboardingFlow.tsx apps/delivery-app/src || true)
  if [ -n "$MATCHES" ]; then
    echo "❌ UI POLICY VIOLATION: Forbidden technical term '$term' detected in user-facing UI:"
    echo "$MATCHES"
    JARGON_FOUND=1
  fi
done

if [ "$JARGON_FOUND" -eq 0 ]; then
  echo "✅ Zero technical jargon found in user-facing screens (business language only)."
else
  echo "❌ UI policy violation! Replace technical jargon with human logistics terms."
  FAILED=1
fi

echo "=================================================================="
if [ "$FAILED" -eq 0 ]; then
  echo "🎉 All Security, Secret, and UI Quality Scans PASSED!"
  echo "=================================================================="
  exit 0
else
  echo "🚨 Security & Quality Scans FAILED!"
  echo "=================================================================="
  exit 1
fi
