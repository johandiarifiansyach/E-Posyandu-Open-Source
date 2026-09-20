# Arsip migrasi Cloudflare Worker

Dokumen ini adalah catatan historis. Backend Cloudflare Worker dan Neon Read
Worker sudah dipensiunkan; jangan gunakan instruksi di bawah untuk deployment
baru. Frontend tetap diterbitkan melalui Cloudflare Pages, sedangkan API aktif
berjalan di Oracle Compute melalui `backend/services/oracle-api`.

## Kondisi historis

| Area | Pemilik | Status |
| --- | --- | --- |
| Frontend native TypeScript/HTML5/CSS | Cloudflare Pages | Produksi |
| Login, profil, CRUD, dashboard, tabel, ASI, ekspor | Rust Cloudflare Worker | Arsip |
| PostgreSQL dan Supabase Auth | Supabase | Sumber data tunggal |
| Kalkulasi status gizi dan agregasi dashboard | PostgreSQL RPC dipanggil Worker | Produksi |

## Aturan utama

1. Browser dahulu berbicara ke Cloudflare Worker. Secret Key Supabase tidak pernah dikirim ke browser.
2. Worker membatasi kader pada desa dan posyandu akun, desa pada wilayahnya, dan gizi dapat memakai filter desa serta posyandu.
3. Halaman balita dan ASI mengambil maksimal 10 data. Pencarian dilakukan setelah tombol Cari ditekan.
4. Ekspor adalah pengecualian yang disengaja: seluruh data hanya dikirim setelah pengguna memilih ekspor, tetap dengan batasan akses wilayah.

## Validasi arsip

1. Worker tidak lagi diterbitkan. Bila perlu menguji arsip, jalankan
   `npm run legacy:worker:check` dan `npm run legacy:worker:test`.
2. Jalankan `npm run pages:deploy` untuk menerbitkan frontend bila tampilan atau TypeScript berubah.
3. Uji akun kader, desa, dan gizi pada API Oracle setelah perubahan akses atau query data.
