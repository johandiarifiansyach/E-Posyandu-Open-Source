# Struktur Proyek

Struktur ini memisahkan kode berdasarkan tanggung jawab agar lokasi perubahan mudah ditebak dan setiap folder memiliki satu tujuan utama.

```text
E-POSYANDU/
├── frontend/
│   ├── public/              Aset publik, PWA, header, dan redirect
│   ├── e2e/                 Pengujian browser desktop dan ponsel
│   └── src/
│       ├── api/             Adapter API React
│       ├── components/      Komponen UI React yang digunakan ulang
│       ├── features/        Implementasi fitur per domain
│       ├── pages/           Halaman dan alur utama React
│       ├── compat/          Kontrak, utilitas, data WHO, dan CSS bersama
│       ├── services/        Penyimpanan, ekspor, dan sinkronisasi lokal
│       ├── styles/          Stylesheet React dan token visual
│       ├── theme/           Mode terang dan gelap
│       └── ui/              Ikon, tooltip, notifikasi, dan modal bersama
├── backend/
│   ├── data/                Data referensi untuk kalkulasi server
│   ├── scripts/             Generator artefak backend
│   ├── graphql-schema.graphql Kontrak GraphQL untuk gateway Oracle
│   ├── openapi.json         Kontrak REST untuk gateway Oracle
│   ├── services/             Semua service yang dijalankan di Oracle
│   │   ├── eposyandu-proto/  Kontrak protobuf/gRPC bersama antarservice
│   │   ├── oracle-api/       API gateway native dan proxy gRPC
│   │   ├── oracle-domain/    Implementasi domain bersama selama migrasi kode
│   │   ├── identity-service/ Microservice autentikasi dan administrasi akun
│   │   ├── read-service/    Microservice read-only tabel/dashboard/analisis
│   │   ├── write-service/   Microservice CRUD, outbox, dan invalidasi cache
│   │   ├── operations-service/ Microservice legacy gabungan (rollback)
│   │   ├── realtime-service/ Microservice stream perubahan data
│   │   ├── monitoring-service/ Microservice metrik operasional admin
│   │   ├── analysis-worker/ Service Rust/PyO3 (transport dan health)
│   │   ├── analysis-service/ Modul Python kalkulasi WHO deterministik
│   │   └── data-processing-service/ Worker job berat Rust
│   └── legacy-cloudflare-worker/ Arsip Worker lama, tidak untuk deployment
├── deploy/oracle/           Runtime terisolasi dan bootstrap service Oracle
├── database/migrations/     Migration PostgreSQL berurutan
├── docs/                    Dokumentasi arsitektur dan operasional
├── scripts/database/        Backup, restore, dan penerapan migration
└── tests/integration/       Kontrak lintas frontend, backend, dan database
```

## Aturan Penempatan

- Tambahkan halaman baru ke `frontend/src/pages` dan implementasi domainnya
  ke `frontend/src/features`.
- Tambahkan komponen React yang dipakai beberapa halaman ke
  `frontend/src/components`.
- Akses jaringan frontend hanya ditambahkan melalui `frontend/src/api`.
- Kode penyimpanan browser dan sinkronisasi lokal ditempatkan di
  `frontend/src/services`.
- Gunakan `frontend/src/compat` hanya untuk kontrak, utilitas, data WHO,
  dan stylesheet bersama yang belum memiliki padanan React khusus.
- Endpoint publik ditempatkan di `backend/services/oracle-api`; service domain dan gRPC privat berada di `backend/services`.
- Browser memakai HTTPS ke gateway untuk autentikasi, CRUD, sinkronisasi ringan,
  progres, dan unduhan. GraphQL hanya untuk query baca dashboard dan laporan
  terpaginasikan. `oracle-api` tidak mengakses implementasi domain saat mode
  microservices aktif; ia meneruskan envelope HTTP internal melalui gRPC ke
  service pemilik domain. Komunikasi service-to-service native memakai
  gRPC/HTTP2 dengan kontrak pada `backend/services/eposyandu-proto`; gRPC tidak pernah
  dibuka langsung ke browser.
- PostgreSQL Oracle native adalah sumber kebenaran dan tujuan tulis aplikasi pada mode produksi. Supabase tetap dipertahankan sebagai jalur legacy/rollback, sedangkan gateway dan domain service selalu memvalidasi scope sebelum membaca atau menulis.
- Setiap perubahan struktur database wajib menjadi migration baru di `database/migrations`.
- Jangan menyimpan output build, cache, `.env`, `.dev.vars`, backup, atau credential ke Git.
