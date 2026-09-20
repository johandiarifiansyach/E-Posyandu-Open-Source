#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later



set -euo pipefail

SERVICE_URL="${1:-}"

if [[ -z "$SERVICE_URL" ]]; then
  printf 'Penggunaan: npm run data-processing:connect:render -- https://nama-service.onrender.com\n' >&2
  exit 1
fi

if [[ "$SERVICE_URL" != https://* ]]; then
  printf 'URL Render harus memakai HTTPS.\n' >&2
  exit 1
fi

HEALTH_URL="${SERVICE_URL%/}"
if [[ "$HEALTH_URL" != */health ]]; then
  HEALTH_URL="$HEALTH_URL/health"
fi

printf 'Memeriksa data-processing worker di %s ...\n' "$HEALTH_URL"
curl --fail --silent --show-error \
  --retry 12 \
  --retry-all-errors \
  --retry-delay 5 \
  --max-time 15 \
  "$HEALTH_URL"
printf '\nData-processing worker aktif di Oracle/Render: %s\n' "$HEALTH_URL"
printf 'Backend Cloudflare Worker sudah dipensiunkan; koneksi edge tidak diperlukan.\n'
