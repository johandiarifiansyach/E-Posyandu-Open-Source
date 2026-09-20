#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later


set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$script_dir/deploy-oracle-nutrition-worker.sh" "${1:-}" "${2:-}" monitoring-service
