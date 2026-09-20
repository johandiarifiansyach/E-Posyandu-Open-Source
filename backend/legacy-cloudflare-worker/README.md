# E-Posyandu Cloudflare Worker (arsip)

Kode ini adalah arsip Worker backend lama. API produksi sekarang berjalan di
Oracle; Cloudflare hanya menerbitkan frontend melalui Pages. Folder ini tidak
ikut build, test, atau deployment aktif.

Alamat produksi:

- Frontend: `https://e-posyandu.pages.dev`
- API lama: `https://e-posyandu-api.eposyandu-puskesmas-demo.workers.dev`

## Prinsip hemat limit

- Tidak ada polling atau realtime.
- CORS preflight dijawab di edge tanpa panggilan ke Supabase.
- Daftar Balita, daftar masalah gizi, dan ASI Eksklusif memakai pagination maksimal 10 data serta pencarian manual.
- Dashboard dan seluruh daftar laporan memakai tanggal acuan, cakupan wilayah, relasi data, serta aturan umur 0-59 bulan yang sama.
- Dashboard dihitung oleh fungsi PostgreSQL dan mengirim angka ringkasan, bukan seluruh data balita.
- Daftar balita, penimbangan, dan koleksi dinamis dicache di Upstash Redis selama 5 menit; dashboard operasional tetap 60 detik. Cache dipisahkan menurut peran/desa/posyandu dan versi invalidasinya dinaikkan setiap ada perubahan data.
- Perubahan offline dikirim maksimal 25 item melalui `POST /api/v1/sync`; pengambilan delta memakai cursor `updated_at` dan tombstone penghapusan.
- Setiap mutasi memakai idempotency key, optimistic version, request ID, dan audit backend.
- Ekspor mengambil seluruh data hanya setelah pengguna meminta ekspor dan tetap dibatasi desa/posyandu sesuai peran.
- Endpoint internal `POST /internal/v1/nutrition/batch` tetap tersedia bila kelak diperlukan oleh layanan lain dan wajib memakai HMAC-SHA256.

## Kontrak API

- REST `/api/v1/*`: autentikasi, CRUD, sinkronisasi offline, dan ekspor.
- GraphQL `POST /api/v1/graphql`: query baca dashboard, halaman balita, dan ASI eksklusif. Endpoint ini memakai sesi HttpOnly serta pembatasan wilayah yang sama dengan REST. Bearer token tetap diterima hanya untuk smoke test/operasi terkontrol.
- gRPC `backend/services/data-processing-service`: validasi impor, normalisasi sinkronisasi, dan pembuatan XLSX/PDF pada jaringan privat. Job laporan gizi diteruskan ke `analysis-worker` Rust/PyO3 (modul Python); service ini tidak dipanggil langsung oleh browser dan tidak dijalankan di runtime Cloudflare Worker.
- Cloudflare Queue `e-posyandu-jobs`: antrean pekerjaan berat agar login dan CRUD tetap responsif. Status job dibaca melalui REST `/api/v1/jobs/{jobId}`.

Schema GraphQL dapat dibaca melalui `GET /api/v1/graphql/schema`. Service data-processing lokal dijalankan dari root dengan `npm run data-processing:dev` dan memakai UDS `unix:///tmp/e-posyandu/data-processing.sock` secara default; URL TCP tetap dapat dipilih lewat `DATA_PROCESSING_GRPC_ADDR`/`DATA_PROCESSING_GRPC_URL` untuk lintas server.

## Penyimpanan Data

| Layanan | Tugas | Jenis data |
| --- | --- | --- |
| Supabase PostgreSQL | Sumber data utama | Balita, penimbangan, ASI, PMT, akun, dan audit |
| Cloudflare KV | Cache global | Feature flag, menu, dan referensi global yang jarang berubah; tidak menyimpan data balita, penimbangan, sesi, atau token |
| Upstash Redis | Cache dinamis dan state sementara | Respons balita/penimbangan/koleksi maksimal 5 menit, dashboard maksimal 60 detik, sesi backend, scope baca darurat, status operasional, dan pembatas login |
| Cloudflare R2 | Berkas privat | Hasil XLSX/PDF background job serta lampiran bila fiturnya diaktifkan |
| Cloudflare Queue | Antrean | ID job validasi impor, laporan besar, ekspor, dan sinkronisasi antarsistem |

Data medis per balita tidak pernah dicache di KV atau dipindahkan ke R2. Redis hanya menyimpan salinan sementara maksimal 5 menit (dashboard operasional maksimal 60 detik) dengan key yang di-hash dan dipisah menurut cakupan akses. PostgreSQL tetap menjadi sumber kebenaran dan setiap mutasi menaikkan versi cache agar data lama tidak dibaca kembali.

## Migrasi Database

SQL produksi berada di [`../database/migrations`](../database/migrations). Jalankan berurutan dari `001` sampai `015` dengan `npm run db:migrate`. Berkas yang sudah dijalankan menjadi riwayat skema dan tidak diubah lagi. Migrasi `009_security_hardening.sql` menutup akses tabel dari browser, `010_sync_versioning_and_audit.sql` menambahkan versioning dan registri migrasi, `011_operational_audit.sql` melengkapi audit login, ekspor, dan perubahan role, migrasi `013` dan `014` menyatukan aturan hitung laporan, dan migrasi `015` menambahkan status background job yang privat.

Kontrak REST API dapat dibuka pada `GET /api/v1/openapi.json`. Health check tersedia pada `GET /api/v1/health` dan tidak membaca tabel balita, sehingga pemeriksaan rutin tidak menambah egress data medis.

### Referensi historis: Redis

Buat database Redis di Upstash, lalu masukkan kedua nilai REST API sebagai Cloudflare Worker Secret. Nilainya tidak boleh masuk ke frontend atau Git.

```bash
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

Konfigurasi ini hanya berlaku untuk Worker lama dan tidak perlu diisi pada
deployment Oracle.

### Referensi historis: R2

1. Pada Cloudflare Dashboard buka **R2 Object Storage**, setujui aktivasi, lalu buat bucket privat bernama `e-posyandu-files`.
2. Buka konfigurasi R2 lama pada `wrangler.toml`.
3. Migrasikan berkas ke storage Oracle sebelum mengaktifkan kembali layanan.

R2 tetap opsional untuk fungsi aplikasi utama. Binding ini dibutuhkan ketika hasil background job XLSX/PDF ingin disimpan dan diunduh; validasi impor, kalkulasi laporan, sinkronisasi, login, serta CRUD tidak bergantung pada R2.

## Menjalankan arsip (audit saja)

```bash
cd backend/legacy-cloudflare-worker
cp .dev.vars.example .dev.vars
rustup target add wasm32-unknown-unknown
cargo install worker-build
npx wrangler dev
```

Build memakai mode Worker standar. Kesalahan API ditangani sebagai respons JSON sehingga tidak memerlukan panic recovery pada runtime.

## Secret Cloudflare (arsip)

Jalankan perintah berikut dari folder ini. Nilai secret akan diminta oleh terminal dan tidak dicatat di Git.

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

`SUPABASE_SECRET_KEY` adalah Secret Key dari Supabase Settings > API Keys.
Secret tersebut tidak lagi diperlukan oleh jalur produksi Oracle.

## Deployment

```bash
npm run legacy:worker:check
```

Tidak ada deployment Worker backend. Gunakan perintah legacy hanya untuk audit;
rilis production dilakukan melalui service Oracle dan Cloudflare Pages.

## Deploy frontend

```bash
npm run pages:deploy
```

Frontend diterbitkan dari folder `frontend` melalui Cloudflare Pages; Pages
mem-proxy request `/api` ke gateway Oracle.
