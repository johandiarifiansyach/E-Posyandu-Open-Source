#!/usr/bin/env bash
# Copyright (C) 2026 Johandi Arifiansyach

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$script_dir/install-nutrition-grpc-macos.sh" "$@"
