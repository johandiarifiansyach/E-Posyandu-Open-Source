# SPDX-License-Identifier: GPL-3.0-or-later

# Compatibility image for the retired Render nutrition worker. The service is
# still connected to this legacy Dockerfile path, while the maintained
# implementation now lives under backend/services/data-processing-service.
FROM docker.io/library/rust:1.97-slim-bookworm AS builder

WORKDIR /app
COPY backend/services/data-processing-service backend/services/data-processing-service
COPY backend/services/eposyandu-proto backend/services/eposyandu-proto
COPY backend/services/analysis-service/proto backend/services/analysis-service/proto
RUN cargo build --locked --release --bin data-processing-cloud --manifest-path backend/services/data-processing-service/Cargo.toml

FROM docker.io/library/debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 eposyandu \
    && install -d -o 10001 -g 10001 -m 0700 /run/e-posyandu

COPY --from=builder /app/backend/services/data-processing-service/target/release/data-processing-cloud /usr/local/bin/data-processing-worker

USER eposyandu
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/data-processing-worker"]
