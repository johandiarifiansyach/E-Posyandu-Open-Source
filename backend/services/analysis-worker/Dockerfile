# SPDX-License-Identifier: GPL-3.0-or-later

# Build against the same CPython minor version used at runtime.  PyO3 embeds
# this interpreter; using a matching builder avoids ABI surprises while still
# keeping the public service binary Rust.
FROM docker.io/library/python:3.12-slim AS builder

ENV PYO3_PYTHON=/usr/local/bin/python
WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
       build-essential ca-certificates curl pkg-config libssl-dev \
  && rm -rf /var/lib/apt/lists/* \
  && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
       | sh -s -- -y --profile minimal --default-toolchain 1.97.0
ENV PATH=/root/.cargo/bin:$PATH

COPY backend/services/analysis-worker backend/services/analysis-worker
COPY backend/services/eposyandu-proto backend/services/eposyandu-proto
COPY backend/services/data-processing-service/proto backend/services/data-processing-service/proto
COPY backend/services/analysis-service/proto backend/services/analysis-service/proto
RUN cargo build --locked --release --manifest-path backend/services/analysis-worker/Cargo.toml

FROM docker.io/library/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend/services/analysis-service

WORKDIR /app
COPY backend/services/analysis-worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt \
  && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin eposyandu \
  && install -d -o 10001 -g 10001 -m 0700 /run/e-posyandu

COPY backend/services/analysis-service/analysis_service /app/backend/services/analysis-service/analysis_service
COPY backend/services/analysis-service/data /app/backend/services/analysis-service/data
COPY frontend/src/compat/data/whoGrowthLms.ts /app/frontend/src/compat/data/whoGrowthLms.ts
COPY --from=builder /app/backend/services/analysis-worker/target/release/e-posyandu-analysis-worker /usr/local/bin/e-posyandu-analysis-worker

USER 10001:10001
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8082/ready', timeout=2)"]
ENTRYPOINT ["/usr/local/bin/e-posyandu-analysis-worker"]
