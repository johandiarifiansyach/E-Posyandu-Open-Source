# Deployment adapter umum

Direktori ini adalah titik awal deployment E-Posyandu pada infrastruktur
pilihan pengembang. Tidak ada ketergantungan wajib pada vendor tertentu.

1. Salin `.env.example` ke secret manager atau file environment deployment.
2. Isi URL PostgreSQL, cache, antrean, storage, autentikasi, dan endpoint
   service sesuai platform tujuan.
3. Jalankan migrasi database, service backend, frontend, dan worker memakai
   image atau proses yang dikelola platform Anda.
4. Pastikan `/api/health` dan endpoint readiness dipasang pada health check.

Kontrak service dan daftar environment dijelaskan di
[`docs/INFRASTRUCTURE.md`](../../docs/INFRASTRUCTURE.md). Folder
`deploy/oracle` tetap tersedia sebagai adapter kompatibilitas deployment lama;
folder tersebut tidak menjadi default untuk deployment baru.
