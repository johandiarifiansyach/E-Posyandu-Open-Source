# E-Posyandu backend

Seluruh API dan service produksi berjalan di Oracle. Folder ini menjadi rumah
untuk service backend tanpa runtime Cloudflare Worker.

## Struktur

- `services/oracle-api`: gateway HTTP publik.
- `services/oracle-domain`: implementasi domain bersama service gRPC.
- `services/identity-service`, `read-service`, `write-service`, dan service
  operasional lain: proses privat yang dijalankan di Oracle melalui Compose.
- Worker Python tetap disertakan untuk perhitungan WHO/LMS, N/T/O/B, ASI,
  statistik, dan grafik deterministik; machine learning dan prediksi tidak
  termasuk pada varian open-source demo ini.
- `graphql-schema.graphql` dan `openapi.json`: kontrak API yang dipakai gateway
  Oracle dan frontend.
- `legacy-cloudflare-worker`: arsip Worker lama, tidak dibangun atau
  dideploy oleh pipeline produksi.

Build dan deployment service dilakukan dari root repository:

```bash
npm run oracle:api:check
npm run oracle:api:test
npm run oracle:deploy:all -- ALIAS_SSH DOMAIN_HEALTH
```

Cloudflare hanya digunakan untuk hosting frontend Pages. Migrasi dan rujukan
historis Worker lama tetap disimpan di `legacy-cloudflare-worker` agar dapat
diaudit tanpa menjadi bagian dari jalur produksi.
