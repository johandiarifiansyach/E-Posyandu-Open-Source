# Infrastruktur provider-neutral

E-Posyandu dapat dijalankan pada VM, container, Kubernetes, PaaS, atau server
on-premise. Folder dan skrip yang menyebut provider tertentu tetap disimpan
sebagai adapter kompatibilitas, tetapi instalasi baru sebaiknya dimulai dari
konfigurasi umum di bawah ini.

## Prinsip konfigurasi

1. Aplikasi tidak mengharuskan Cloudflare, Oracle, Supabase, atau Neon.
2. Pengembang memilih implementasi untuk API, PostgreSQL, cache, antrean,
   object storage, dan autentikasi sesuai infrastrukturnya.
3. Nilai `EPOSYANDU_*` adalah nama konfigurasi umum yang dianjurkan.
4. Nama environment lama tetap diterima oleh adapter lama agar deployment
   existing tidak rusak. Jika nama umum dan nama lama sama-sama diisi, nama
   umum diprioritaskan.

## Konfigurasi inti

Salin [`deploy/generic/.env.example`](../deploy/generic/.env.example) menjadi
`.env` untuk deployment yang baru.

| Fungsi | Environment umum | Keterangan |
| --- | --- | --- |
| Mode aplikasi | `EPOSYANDU_ENVIRONMENT` | `development`, `staging`, atau `production` |
| API listener | `EPOSYANDU_API_LISTEN_ADDR` | Contoh `0.0.0.0:8081` |
| URL publik API | `EPOSYANDU_API_URL` | Dipakai worker dan service internal |
| URL frontend | `EPOSYANDU_PUBLIC_ORIGIN` | Origin HTTPS tanpa path |
| PostgreSQL | `EPOSYANDU_DATABASE_URL` | URL PostgreSQL biasa |
| Ukuran pool | `EPOSYANDU_DATABASE_POOL_SIZE` | 1–10 pada API native |
| Cache | `EPOSYANDU_CACHE_URL` | Redis-compatible atau adapter cache lain |
| Antrean | `EPOSYANDU_QUEUE_API_URL` | Endpoint adapter antrean |
| Identitas antrean | `EPOSYANDU_QUEUE_ACCOUNT_ID`, `EPOSYANDU_QUEUE_ID` | Opsional bila provider memerlukannya |
| Token antrean | `EPOSYANDU_QUEUE_TOKEN` | Secret server-side |
| Secret internal | `EPOSYANDU_SHARED_SECRET` | HMAC antarservice |
| gRPC pemrosesan | `EPOSYANDU_DATA_PROCESSING_GRPC_URL` | UDS atau `http://host:port` |
| Storage | `EPOSYANDU_STORAGE_ENDPOINT`, `EPOSYANDU_STORAGE_BUCKET` | S3-compatible atau adapter storage |
| Auth | `EPOSYANDU_AUTH_URL`, `EPOSYANDU_AUTH_PUBLIC_KEY`, `EPOSYANDU_AUTH_SECRET_KEY` | Kontrak adapter autentikasi; adapter native saat ini kompatibel dengan API auth yang sudah ada |

Frontend memakai prefix `VITE_`. Minimal:

```env
VITE_API_URL=https://api.example.invalid
VITE_DEV_API_TARGET=http://127.0.0.1:8081
VITE_SECURITY_CHALLENGE_SITE_KEY=
VITE_SECURITY_CHALLENGE_URL=
```

Challenge keamanan bersifat opsional. Adapter lama Turnstile tetap tersedia;
untuk challenge lain, sediakan adapter frontend/backend yang mengembalikan
token sesuai kontrak login.

## Adapter provider lama

`backend/legacy-cloudflare-worker`, `deploy/oracle`, skrip `oracle:*`, dan
skrip replika database adalah contoh adapter historis, bukan persyaratan
aplikasi. Jangan menghapusnya jika deployment lama masih menggunakannya.
Untuk provider lain, pertahankan kontrak HTTP/gRPC dan format pesan yang
dijelaskan pada `backend/README.md`, lalu isi environment umum atau buat adapter
baru di bawah `deploy/<nama-adapter>`. Nama umum memindahkan konfigurasi; ia
tidak mengubah protokol vendor yang sudah dipakai oleh adapter lama.

## Checklist deployment

- PostgreSQL sudah dimigrasikan dengan `npm run db:migrate`.
- API, worker analisis, dan worker pemrosesan dapat menjangkau database.
- Secret internal, token antrean, dan kredensial storage hanya berada di secret
  manager atau environment server.
- `VITE_API_URL` mengarah ke API publik yang benar.
- Health endpoint `/api/health` dan endpoint readiness setiap service dapat
  diakses oleh pemeriksa deployment.
- Jalankan `npm run frontend:react:check`, `npm run frontend:react:build`, dan
  pemeriksaan service yang dipilih sebelum rilis.
