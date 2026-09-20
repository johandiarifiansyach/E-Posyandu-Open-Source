#!/usr/bin/env bash
# Copyright (C) 2026 Johandi Arifiansyach

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$script_dir/deploy-oracle-nutrition-worker.sh" "${1:-}" "${2:-}" write-service
