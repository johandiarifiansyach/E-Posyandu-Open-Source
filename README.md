# E-Posyandu Open Source

E-Posyandu adalah aplikasi pencatatan dan pemantauan balita untuk puskesmas,
desa, bidan, dan kader posyandu. Fitur utama meliputi data balita, pengukuran,
pertumbuhan, ASI eksklusif, MPASI, PMT, riwayat perubahan, ekspor, dan
dashboard program.

Repository ini disiapkan sebagai titik awal pengembangan. Data lokasi dan akun
yang disertakan adalah data demo sehingga pengembang dapat menggantinya dengan
konfigurasi organisasinya sendiri.

## Yang perlu diketahui sebelum mulai

- Frontend utama menggunakan React, TypeScript, Vite, dan Tailwind CSS.
- Backend menggunakan Rust dengan API HTTP dan service internal gRPC.
- PostgreSQL menjadi sumber data aplikasi pada deployment penuh.
- Python tetap digunakan untuk perhitungan WHO/LMS, status N/T/O/B, ASI,
  statistik, dan grafik pertumbuhan secara deterministik.
- Paket ini tidak menyertakan MCP server, machine learning, atau prediksi.
- Login demo hanya tersedia pada server Vite development; jalur ini otomatis
  tidak aktif pada build production.

## Mulai dalam lima menit

### Prasyarat

Untuk mengembangkan UI saja, cukup siapkan:

- Git
- Node.js 20 atau lebih baru
- npm

Untuk menjalankan seluruh backend secara lokal, tambahkan Rust stable, Python
3.11 atau lebih baru, PostgreSQL, dan toolchain service yang dijelaskan pada
README masing-masing service.

### Instalasi

~~~
git clone <URL-repository-anda>
cd E-Posyandu-Open-Source
npm install
cp frontend/.env.example frontend/.env.local
npm run dev
~~~

Buka [http://127.0.0.1:5176](http://127.0.0.1:5176). Server Vite akan
menjalankan frontend React dan menyediakan proxy `/api` ke target yang diatur
oleh `VITE_DEV_API_TARGET`.

Jika backend belum dijalankan, halaman login demo tetap dapat digunakan, tetapi
halaman yang mengambil data dashboard akan memerlukan API yang aktif.

## Akun demo

Gunakan salah satu username berikut pada halaman login development. Semua akun
memakai password default `Demo123!`.

| Username | Email alternatif | Peran | Cakupan demo |
| --- | --- | --- | --- |
| `admin` | `admin@demo.eposyandu.local` | Administrator | Semua data |
| `gizi` | `gizi@demo.eposyandu.local` | Ahli Gizi | Semua data |
| `bidan` | `bidan@demo.eposyandu.local` | Bidan Desa | Desa Demo |
| `kader` | `kader@demo.eposyandu.local` | Kader Posyandu | Desa Demo / Posyandu Demo 1 |

Data demo bawaan:

- Puskesmas: **Puskesmas Demo**
- Desa: **Desa Demo**
- Posyandu: **Posyandu Demo 1** dan **Posyandu Demo 2**

Password dapat diganti tanpa mengubah kode:

~~~
VITE_DEMO_PASSWORD='password-lokal-anda' npm run dev
~~~

Atau isi `VITE_DEMO_PASSWORD` pada `frontend/.env.local`. Untuk menguji login
provider nyata, set `VITE_DEMO_AUTH=false` dan siapkan backend autentikasi.

## Konfigurasi environment

Semua variabel `VITE_*` masuk ke bundle browser. Jangan menaruh secret,
service-role key, password database, atau private key di dalamnya.

| Variabel | Kegunaan |
| --- | --- |
| `VITE_API_URL` | URL API saat build atau preview |
| `VITE_DEV_API_TARGET` | Target proxy `/api` saat `npm run dev` |
| `VITE_DEMO_AUTH` | `true` untuk akun demo lokal, `false` untuk mematikannya |
| `VITE_DEMO_PASSWORD` | Password akun demo lokal |
| `VITE_APP_ID` | ID aplikasi pada provider autentikasi yang digunakan |
| `VITE_TURNSTILE_SITE_KEY` | Verifikasi keamanan login, opsional |
| `VITE_MAINTENANCE_MODE` | Menampilkan halaman maintenance bila bernilai `true` |
| `VITE_REACT_PROFILER` | Profiling React development bila bernilai `true` |

## Peta repository

~~~
frontend/
├── src/app/              bootstrap aplikasi, AuthGate, session, query client
├── src/api/              semua adapter HTTP frontend
├── src/components/       komponen UI reusable
├── src/features/         implementasi domain per fitur
├── src/pages/            entrypoint halaman dan registry halaman
├── src/compat/           kontrak, utilitas, data WHO, dan CSS bersama
├── src/services/         penyimpanan offline, ekspor, dan sinkronisasi
├── src/stores/           state global kecil berbasis Zustand
├── public/               logo, batik login, PWA, dan asset statis
└── e2e/                  pengujian browser React

backend/
├── services/oracle-api/          gateway HTTP publik
├── services/identity-service/    autentikasi dan akun
├── services/read-service/        query baca dan dashboard
├── services/write-service/       CRUD dan outbox perubahan
├── services/analysis-service/    modul Python WHO deterministik
├── services/analysis-worker/     transport Rust/PyO3 untuk Python
├── services/eposyandu-proto/     kontrak protobuf/gRPC
└── graphql-schema.graphql,       kontrak API
    openapi.json

database/migrations/              migrasi PostgreSQL berurutan
docs/                             arsitektur, operasi, privasi, dan standar WHO
scripts/                          pemeriksaan, migrasi, backup, dan deployment
tests/                            integration test dan test frontend
~~~

Aturan penempatan kode lebih rinci tersedia di
[`docs/STRUCTURE.md`](docs/STRUCTURE.md).

## Alur arsitektur

~~~
Browser
  │ React + TypeScript
  ▼
API gateway Rust
  ├── PostgreSQL (data utama, akun, audit)
  ├── service baca/tulis dan realtime melalui gRPC
  └── analysis-worker Rust/PyO3
        └── analysis-service Python
             └── WHO/LMS, N/T/O/B, ASI, statistik, grafik
~~~

Browser tidak menghitung ulang status klinis. Nilai turunan berasal dari
runtime Python dan dibaca melalui kontrak API. Jika menambah indikator baru,
ubah kontrak, service Python, penyimpanan hasil, endpoint Rust, dan UI secara
berurutan; jangan menambahkan perhitungan klinis hanya di komponen React.

## Alur kerja frontend

1. Tentukan kontrak request/response pada `frontend/src/api/` dan, bila perlu,
   `backend/openapi.json` atau `backend/graphql-schema.graphql`.
2. Tambahkan aturan domain pada `frontend/src/features/<domain>/`.
3. Tambahkan halaman pada `frontend/src/pages/`, lalu daftarkan di
   `frontend/src/pages/pageRegistry.ts` dan router bila halaman memiliki route
   baru.
4. Tambahkan navigasi desktop di `frontend/src/components/navigation/Sidebar.tsx`
   dan navigasi mobile di `MobileBottomNav.tsx` bila diperlukan.
5. Gunakan komponen reusable pada `frontend/src/components/`. Style global dan
   token berada di `frontend/src/compat/styles/`.
6. Tambahkan test untuk alur baru sebelum membuat pull request.

Halaman dashboard memakai `ReactDashboardShell`. Query yang menggunakan filter
atau pagination harus memiliki query key yang lengkap agar cache tidak
tertukar antarperiode, desa, posyandu, atau kelompok umur.

## Perhitungan Python dan data WHO

Kode analisis berada di `backend/services/analysis-service/analysis_service/`:

- `who.py`: tabel LMS dan z-score WHO.
- `deterministic.py`: N/T/O/B dan klasifikasi ASI.
- `analytics.py`: agregasi dashboard dan ringkasan statistik.
- `charts.py`: grafik pertumbuhan.
- `persistence.py`: penyimpanan hasil analisis dan versi input.

Jalankan unit test Python:

~~~
PYTHONPATH=backend/services/analysis-service \
python3 -m unittest discover \
  -s backend/services/analysis-service/tests -p 'test_*.py'
~~~

Data referensi WHO harus tetap konsisten antara Python dan frontend. Setelah
mengubah sumber data antropometri, jalankan pemeriksaan standar dan dokumentasi
provenance pada `docs/WHO-STANDARDS.md`.

## Database dan migrasi

Setiap perubahan schema wajib menjadi file migrasi baru di
`database/migrations/`. Jangan mengedit migrasi yang sudah diterapkan di
environment lain.

~~~
DATABASE_URL='postgresql://user:password@host:5432/database' npm run db:migrate
~~~

Urutan operasi yang aman:

1. Backup database.
2. Terapkan migrasi di database pengembangan atau staging.
3. Jalankan test dan smoke test.
4. Periksa hasil dashboard, tabel balita, ASI, MPASI, PMT, ekspor, dan audit.
5. Terapkan migrasi yang sama ke production.

Detail migrasi, backup, restore, dan batas keamanan ada di
[`database/README.md`](database/README.md) dan
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Perintah pengembangan yang sering digunakan

~~~
# Frontend
npm run dev
npm run frontend:react:check
npm run frontend:react:build
npm run frontend:react:test
npm run frontend:react:perf

# Kontrak dan integration test
npm run integration:test
npm run ci

# Backend Rust
npm run oracle:api:check
npm run oracle:api:test
npm run data-processing:check
npm run data-processing:test

# Analisis Python
PYTHONPATH=backend/services/analysis-service \
python3 -m unittest discover \
  -s backend/services/analysis-service/tests -p 'test_*.py'
~~~

`frontend:react:test` menjalankan Playwright pada server Vite terisolasi.
Test backend yang membutuhkan database atau service eksternal harus dijalankan
dengan environment pengujian, bukan memakai data production.

## Menambahkan organisasi dan akun sendiri

Data demo bukan tempat menyimpan data operasional. Untuk instalasi baru:

1. Siapkan database dan provider autentikasi sendiri.
2. Terapkan seluruh migrasi sesuai urutan.
3. Buat akun dan hubungkan `user_id`, role, desa, posyandu, dan `access_mode`
   pada tabel aplikasi melalui backend.
4. Ganti nama puskesmas, desa, posyandu, asset logo, dan seed demo sesuai
   kebutuhan organisasi.
5. Matikan login demo dan gunakan password unik serta MFA.

Jangan commit data pasien, NIK, password, token, backup, atau credential. File
`.env*` lokal sudah diabaikan Git; commit hanya file `.env.example` tanpa nilai
rahasia.

## Kontribusi

Pull request sebaiknya berisi perubahan yang terfokus dan menjelaskan:

- masalah atau kebutuhan yang diselesaikan;
- bagian frontend/backend/database yang berubah;
- migrasi yang diperlukan;
- test yang dijalankan;
- dampak terhadap data pribadi dan keamanan.

Sebelum membuka pull request, jalankan setidaknya:

~~~
npm run frontend:react:check
npm run frontend:react:build
git diff --check
~~~

Laporan kerentanan tidak boleh dibuat sebagai issue publik. Ikuti
[`SECURITY.md`](SECURITY.md) untuk private vulnerability reporting.

## Lisensi

E-Posyandu Open Source dilisensikan berdasarkan **GNU General Public License
v3.0 atau versi lebih baru (GPLv3-or-later)**. Karya turunan yang
didistribusikan harus mempertahankan lisensi copyleft dan menyediakan source
code sesuai ketentuan GPLv3. Teks lengkap tersedia pada [`LICENSE`](LICENSE).

GPLv3 tidak melarang penggunaan komersial; yang diwajibkan adalah menjaga
kebebasan pengguna ketika perangkat lunak atau turunannya dibagikan. Jika
proyek membutuhkan larangan penggunaan komersial, GPLv3 bukan lisensi yang
tepat untuk tujuan tersebut.
