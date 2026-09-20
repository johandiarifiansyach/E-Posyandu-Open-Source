#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later


set -euo pipefail

config_value() {
  local generic_name="$1"
  local compatibility_name="$2"
  local value="${!generic_name:-}"
  if [[ -z "$value" ]]; then
    value="${!compatibility_name:-}"
  fi
  printf '%s' "$value"
}

development_url="$(config_value EPOSYANDU_DEVELOPMENT_DATABASE_URL DEVELOPMENT_SUPABASE_URL)"
staging_url="$(config_value EPOSYANDU_STAGING_DATABASE_URL STAGING_SUPABASE_URL)"
production_url="$(config_value EPOSYANDU_PRODUCTION_DATABASE_URL PRODUCTION_SUPABASE_URL)"
for pair in \
  "EPOSYANDU_DEVELOPMENT_DATABASE_URL:$development_url" \
  "EPOSYANDU_STAGING_DATABASE_URL:$staging_url" \
  "EPOSYANDU_PRODUCTION_DATABASE_URL:$production_url"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  if [[ -z "$value" ]]; then
    printf 'Variabel %s belum diisi.\n' "$name" >&2
    exit 1
  fi
done

database_ref() {
  local value="${1#*://}"
  local authority="${value%%/*}"
  authority="${authority##*@}"
  local host="$authority"
  host="${host%%:*}"
  local database="${value#*/}"
  database="${database%%\?*}"
  printf '%s/%s' "${host}" "${database:-default}"
}

development_ref="$(database_ref "$development_url")"
staging_ref="$(database_ref "$staging_url")"
production_ref="$(database_ref "$production_url")"

for entry in \
  "development:$development_ref" \
  "staging:$staging_ref" \
  "production:$production_ref"; do
  name="${entry%%:*}"
  value="${entry#*:}"
  if [[ -z "$value" || "$value" == "project-ref" ]]; then
    printf 'Database %s tidak valid.\n' "$name" >&2
    exit 1
  fi
done

if [[ "$development_ref" == "$staging_ref" \
  || "$development_ref" == "$production_ref" \
  || "$staging_ref" == "$production_ref" ]]; then
  printf 'Gagal: development, staging, dan production masih memakai database yang sama.\n' >&2
  exit 1
fi

printf 'Berhasil: tiga environment memakai database yang berbeda.\n'
printf 'development=%s, staging=%s, production=%s\n' \
  "$development_ref" "$staging_ref" "$production_ref"
