# E-Posyandu backend

Backend dapat dijalankan pada VM, container, Kubernetes, PaaS, atau server
on-premise. PostgreSQL, cache, antrean, storage, dan autentikasi dipilih melalui
environment provider-neutral `EPOSYANDU_*`; lihat
[`docs/INFRASTRUCTURE.md`](../docs/INFRASTRUCTURE.md). Nama `oracle-api` pada
path dipertahankan agar deployment lama tetap kompatibel, bukan berarti Oracle
wajib digunakan.

## Struktur

- `services/oracle-api`: gateway HTTP publik (nama path kompatibilitas).
- `services/oracle-domain`: implementasi domain bersama service gRPC.
- `services/identity-service`, `read-service`, `write-service`, dan service
  operasional lain: proses internal yang dapat dijalankan pada orchestrator
  pilihan pengembang.
- Worker Python tetap disertakan untuk perhitungan WHO/LMS, N/T/O/B, ASI,
  statistik, dan grafik deterministik; machine learning dan prediksi tidak
  termasuk pada varian open-source demo ini.
- `graphql-schema.graphql` dan `openapi.json`: kontrak API yang dipakai gateway
  dan frontend.
- `legacy-cloudflare-worker`: adapter edge historis, tidak wajib dibangun atau
  dideploy pada instalasi baru.

Build dan deployment service dilakukan dari root repository:

```bash
npm run oracle:api:check # path kompatibilitas; cek service gateway
npm run oracle:api:test
npm run frontend:react:check
npm run frontend:react:build
```

Skrip `oracle:*`, `legacy-cloudflare-worker`, dan adapter provider lain tetap
disimpan agar deployment existing dapat diaudit dan dipelihara. Deployment baru
tidak perlu memakai provider tersebut; gunakan template pada `deploy/generic`.
