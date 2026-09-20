#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later


set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bucket_name="${R2_BUCKET_NAME:-e-posyandu-files}"
if ! output="$(npx --yes wrangler r2 bucket list 2>&1)"; then
  printf '%s\n' "$output" >&2
  if [[ "$output" == *"10042"* || "$output" == *"enable R2"* ]]; then
    printf '\nR2 belum aktif pada akun Cloudflare. Buka Dashboard > R2 Object Storage dan aktifkan langganan R2 terlebih dahulu.\n' >&2
  fi
  exit 1
fi

if [[ "$output" == *"$bucket_name"* ]]; then
  printf 'Bucket R2 %s sudah tersedia.\n' "$bucket_name"
else
  npx --yes wrangler r2 bucket create "$bucket_name"
  printf 'Bucket R2 %s berhasil dibuat.\n' "$bucket_name"
fi

cat <<EOF

R2 tetap dikelola sebagai storage Cloudflare terpisah. Binding Worker backend
lama sudah diarsipkan, sehingga bucket ini belum dipakai oleh jalur API Oracle.
Gunakan hanya untuk migrasi berkas historis sampai storage Oracle-native aktif.
EOF
