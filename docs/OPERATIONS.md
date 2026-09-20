# Operasional dan Monitoring

## Environment

| Environment | Frontend | API Oracle | Tujuan |
| --- | --- | --- | --- |
| Development | Vite `127.0.0.1:5175` | Oracle API development | Database uji lokal/non-production |
| Staging | `e-posyandu-staging.pages.dev` | Oracle API staging | Database staging |
| Production | `e-posyandu.pages.dev` | `https://api.eposyandu.app` | Oracle production untuk kader |

Ketiga environment harus memiliki database dan secret yang terpisah. API Oracle memblokir mutasi non-production terhadap database production. Login, laporan error aman, dan GraphQL baca tetap dapat digunakan untuk diagnosis.

Setelah environment dibuat, periksa pemisahannya sebelum mengisi secret deployment Oracle:

```bash
DEVELOPMENT_SUPABASE_URL='https://project-dev.supabase.co' \
STAGING_SUPABASE_URL='https://project-staging.supabase.co' \
PRODUCTION_SUPABASE_URL='https://project-production.supabase.co' \
npm run env:check
```

Jalankan migration yang sama pada setiap project. Data production tidak disalin ke development; gunakan data uji tanpa identitas nyata.

Variabel dan secret Oracle tidak diwariskan antar-environment. Masukkan secret staging secara terpisah melalui vault Oracle.

Jangan deploy frontend atau API staging sebelum `npm run env:check` berhasil.
Environment development dan staging tidak boleh diisi data identitas atau
kesehatan nyata.

Salin template frontend yang sesuai menjadi file lokal tanpa akhiran `.example`. Nilai `VITE_*` bersifat publik; secret service-role tidak boleh berada di frontend.

## Platform utama di Oracle

Cloudflare Pages menjalankan frontend. Oracle Compute menjalankan `oracle-api`,
domain services, `data-processing-worker`, `analysis-worker` Rust/PyO3, dan
PostgreSQL native sebagai origin serta primary writable untuk data inti. Tidak
ada backend Cloudflare Worker aktif; arsipnya berada di
`backend/legacy-cloudflare-worker`.

Gunakan OCI Ampere A1 Oracle Linux 9 ARM64. Setelah Cloudflare Tunnel aktif,
Network Security Group tidak memiliki ingress publik 22/80/443. SSH hanya lewat
OCI Bastion dan web hanya lewat Tunnel outbound-only. Port `50051`, `8080`,
`8081`, `8088`, serta `2000` tidak boleh memiliki aturan ingress publik.
Panduan lengkap tersedia di
[`deploy/oracle/README.md`](../deploy/oracle/README.md).

Urutan aktivasi production:

1. Deploy service Oracle dan periksa health internal.
2. Materialisasi auth/PostgreSQL/Tunnel dari OCI Vault.
3. Aktifkan `eposyandu-native-mode auth`, lalu `reads`, lalu `full`.
4. Jalankan job ekspor uji dan pastikan status mencapai `completed`.
5. Aktifkan Cloudflare Tunnel/Pages serta route hostname API ke
   `http://health-proxy:8088`.
6. Delegasikan DNS, uji desktop/seluler, lalu bind Caddy ke loopback dan tutup
   ingress publik OCI.
7. Hentikan consumer legacy yang tidak lagi digunakan; backend Cloudflare
   Worker dan Neon Read Worker tetap berada di arsip, bukan di jalur rilis.

Mode production aktif sejak 25 Agustus 2026 adalah `full`. Endpoint koleksi,
sinkronisasi, dashboard, dan laporan inti memakai PostgreSQL Oracle langsung.
Endpoint job Queue/R2 diproses oleh service Oracle dan consumer internal. Jalur
Cloudflare Worker lama hanya disimpan untuk audit dan tidak ikut deployment.

### Aktivasi akun `super_admin`

Akun `super_admin` baru dibuat melalui undangan Supabase Auth dan profil
`app_users` Oracle dengan scope global. Jangan membuat password sementara atau
mengirim password melalui chat. Pemilik akun melakukan aktivasi berikut:

1. Buka email undangan dan pastikan tautan menuju domain `eposyandu.app`.
2. Tetapkan password unik minimal 14 karakter dengan huruf besar, huruf kecil,
   angka, dan simbol.
3. Daftarkan TOTP dari halaman MFA, kemudian verifikasi kode enam digit pertama.
4. Simpan 10 recovery code yang hanya ditampilkan sekali pada media offline.
5. Login ulang dan pastikan nama `Administrator` tampil di pojok kanan atas.

Passkey dapat dijadikan metode utama setelah Passkeys diaktifkan pada Supabase
Dashboard. Passkey memakai endpoint Supabase Passkeys khusus, bukan faktor MFA
`/auth/v1/factors`. Jika akun sudah memiliki TOTP, login dengan TOTP terlebih
dahulu, lalu gunakan tombol `Daftarkan passkey` pada halaman Administrasi Backend.
Header `Permissions-Policy` frontend mengizinkan `publickey-credentials-create`
dan `publickey-credentials-get` hanya untuk origin aplikasi sendiri (`self`),
sehingga browser dapat menjalankan WebAuthn tanpa membuka kemampuan tersebut ke
frame pihak ketiga.
Login password `super_admin` hanya menghasilkan session MFA sementara selama
lima menit; session tersebut tidak boleh membaca data sampai MFA berhasil.
Recovery code bersifat satu kali pakai dan hanya hash-nya yang disimpan
terenkripsi pada session store Oracle.

Pada Supabase production, `Authentication > URL Configuration` wajib memakai:

- Site URL: `https://eposyandu.app`
- Redirect URL aktivasi undangan: `https://eposyandu.app/`
- Redirect URL pemulihan admin: `https://eposyandu.app/admin/activate`

Gunakan URL persis tersebut agar callback tidak kembali ke nilai default
`http://localhost:3000`. Callback `recovery` hanya diterima frontend pada path
khusus `/admin/activate`; fragment token dihapus dari address bar sebelum form
password ditampilkan.

Untuk audit aktivasi, periksa keberadaan tepat satu profil `super_admin`, status
email/MFA pada Auth, event login/MFA, dan jumlah role akun lama. Jangan mencetak
JWT, secret TOTP, QR, recovery code, atau isi file `/run/e-posyandu/*.env` ke log.

### Administrasi backend dan presence akun

Halaman penuh `Administrasi Backend` hanya muncul pada menu profil
`Administrator`, tepat di atas `Keluar Sistem`. Backend endpoint
`GET /api/v1/admin/accounts` tetap memeriksa role `super_admin` dan sesi MFA
terverifikasi, sehingga menyembunyikan menu bukan satu-satunya pengamanan.
Halaman menampilkan kesiapan layanan backend, cakupan akses global, jumlah akun,
serta status aktivitas tiap akun. Halaman ini tidak membuka shell, secret, token,
atau konsol SQL langsung.

Frontend mengirim heartbeat terautentikasi ke `POST /api/v1/auth/presence` setiap
60 detik ketika tab terlihat dan perangkat online. Akun dinyatakan `online` jika
aktif dan memiliki aktivitas dalam 180 detik terakhir; selain itu ditampilkan
`offline`. Oracle menyimpan hash ID akun dan hash sesi beserta waktu aktivitas
terakhir di SQLite operasional; identifier presence hanya berupa hash, sedangkan
payload sesi disimpan terenkripsi AES-256-GCM. Presence lebih lama dari 90 hari
dibersihkan otomatis dan baris sesi aktif dihapus saat logout.

Container service memakai filesystem read-only, pengguna non-root, seluruh
Linux capability dibuang, batas proses/memori/CPU, dan log lokal berotasi.
File persisten `/etc/e-posyandu/*.env` hanya berisi konfigurasi non-secret dan
OCID Vault. Nilai secret dimaterialisasi ke `/run/e-posyandu` (tmpfs, `0600`),
tidak ikut image, archive deployment, log, atau repository.

Exporter `/usr/local/libexec/e-posyandu/eposyandu-oci-metrics.py` berjalan sebagai
systemd timer setiap menit. Exporter hanya mengirim metrik operasional ke
namespace OCI `eposyandu`: `DiskUsagePercent`, `WorkerUp`, `ApiUp`,
`TunnelUp`, dan `HttpsPortUp`.
Tidak ada NIK, token, isi formulir, atau payload Queue yang dikirim. Dynamic Group
worker hanya boleh memakai namespace metrik tersebut melalui policy:

```text
Allow dynamic-group eposyandu-grpc-worker-dg to use metrics in tenancy where target.metrics.namespace='eposyandu'
```

Halaman `Akses Backend Penuh > Monitoring` memakai SSE terautentikasi pada
`GET /api/v1/admin/monitoring/stream`. Stream hanya dapat dibuka oleh
`super_admin` dengan MFA aktif, dibatasi empat koneksi, dan mengambil sampel
CPU, memori, load, disk, jaringan, serta health layanan setiap lima detik.
Frontend membuka stream hanya saat tab Monitoring terlihat dan langsung
menutupnya saat pengguna berpindah tab, browser disembunyikan, jaringan offline,
atau halaman dilepas. Stream tidak memuat data kesehatan maupun identitas akun.

Data aplikasi memakai kanal terpisah `GET /api/v1/realtime/stream`. Mutasi
native menerbitkan metadata perubahan melalui PostgreSQL `NOTIFY`, kemudian
Oracle meneruskannya sebagai SSE. Event hanya berisi resource, operasi, ID
event, dan waktu perubahan; tidak ada NIK, nama, atau nilai pengukuran. Server
memfilter event berdasarkan desa/posyandu akun, sedangkan browser mengambil
ulang query aktif sehingga aturan otorisasi dan cache tetap berlaku. Klien
menutup koneksi ketika tab tidak terlihat, offline, atau tidak ada tampilan
data yang berlangganan.

Buat topic OCI Notifications khusus operasional, lalu buat alarm berikut pada
Monitoring dengan topic tersebut sebagai destination:

| Metrik | Query alarm | Ambang awal |
| --- | --- | --- |
| CPU | `CpuUtilization[5m].mean()` | > 80% |
| Memori | `MemoryUtilization[5m].mean()` | > 85% |
| Disk root | `DiskUsagePercent[5m].mean()` | > 80% |
| Oracle worker | `WorkerUp[5m].mean()` | < 1 |
| API | `ApiUp[5m].mean()` | < 1 |
| Tunnel | `TunnelUp[5m].mean()` | < 1 |
| HTTPS | `HttpsPortUp[5m].mean()` | < 1 |

Untuk alarm Worker, API, Tunnel, dan HTTPS, perlakukan data yang hilang sebagai pelanggaran
agar timer yang berhenti juga terdeteksi. Topic dan email hanya berisi status
operasional; jangan masukkan data kesehatan ke dalam pesan notifikasi.

## Urutan rilis

1. Jalankan `npm run check` dan `npm run build`.
2. Terapkan migrasi PostgreSQL terbaru di staging.
3. Pastikan tidak ada deployment Neon Read Worker atau backend Cloudflare Worker.
4. Jalankan `npm run pages:deploy:staging` untuk frontend dan deploy service Oracle
   yang berubah melalui Bastion.
5. Uji alur online, offline, konflik edit, dan request berulang.
6. Terapkan migrasi di production.
7. Deploy hanya service Oracle yang berubah: `oracle-api`,
   `data-processing-worker`, service domain, atau Pages. Deployment Oracle menerima target
   service sebagai argumen ketiga dan tidak me-restart service lain.
8. Deploy Pages bila frontend ikut berubah. Worker backend lama tidak lagi
   memiliki langkah deploy.

Worker dan migration `027` menutup akses RPC browser langsung. Uji login,
kata sandi salah, refresh sesi, pembatasan percobaan, logout, dan pemulihan akun
di staging. Frontend production memanggil `/api` di domain Pages; `_worker.js`
meneruskannya ke API sehingga cookie `__Host-e-posyandu-session` tetap
first-party di Safari/mobile.

Workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) menjalankan TypeScript check, contract test, unit test Rust, build, dan E2E Chrome/Safari desktop serta ponsel. Deploy production baru aktif setelah repository variable `AUTO_DEPLOY=true` dan secret `DATABASE_URL`, `CLOUDFLARE_API_TOKEN`, serta `CLOUDFLARE_ACCOUNT_ID` tersedia pada GitHub Environment `production`. Setelah deploy, smoke test memeriksa frontend, security headers termasuk endpoint laporan CSP, health API, OpenAPI, dan penolakan akses tanpa sesi.

Smoke test production juga berjalan setiap enam jam melalui `deployment-smoke.yml`. Pemeriksaan manual dapat dijalankan tanpa kredensial:

```bash
SMOKE_FRONTEND_URL='https://e-posyandu.pages.dev' \
SMOKE_API_URL='https://api.eposyandu.app' \
npm run deployment:smoke
```

Primary production yang diharapkan secara default adalah `oracle-postgresql`.
Tidak ada endpoint Worker rollback aktif; pengujian harus diarahkan ke gateway
Oracle atau environment staging terpisah.

Untuk staging, `SMOKE_SESSION_COOKIE` opsional dapat diisi sesaat dengan pasangan nama/nilai cookie sesi, misalnya `__Host-e-posyandu-session=...`. Alternatif kompatibilitasnya adalah `SMOKE_ACCESS_TOKEN`. Keduanya menambahkan pemeriksaan endpoint sesi serta riwayat terautentikasi dan memastikan token tidak muncul di respons. Kredensial ini berumur pendek: jangan simpan sebagai file, log, atau secret jangka panjang. Workflow terjadwal tetap menguji penolakan sesi anonim ketika secret tidak tersedia.

## Audit dan dokumentasi API

Audit database mencatat login berhasil/gagal, CRUD, ekspor XLS, serta perubahan role/wilayah akun. Audit tidak menyimpan kata sandi, token, NIK, KK, nama balita, atau isi formulir. Tabel `audit_events` hanya dapat diakses service role dan administrator database.

Job retensi berjalan otomatis setiap pemicu terjadwal Worker dan setiap 24 jam pada
`oracle-api`. Fungsi database `eposyandu_cleanup_retention` menghapus item Recycle
Bin yang lebih lama dari 30 hari. Data balita yang mencapai 60 bulan tetap disimpan
selama lima tahun pasca-kelulusan, lalu dihapus tepat ketika tanggal retensi itu
tercapai, beserta
data turunannya. Job memakai advisory lock agar dua instance tidak menghapus baris
yang sama, menulis tombstone tanpa payload untuk replika, lalu menaikkan versi cache
Redis. Jalankan migration `031_child_data_retention.sql` pada primary sebelum
menyalakan rilis API yang memanggil job ini; kegagalan job hanya dicatat sebagai
peringatan dan akan dicoba lagi pada jadwal berikutnya.

Kontrak API tersedia pada `GET /api/v1/openapi.json`. Saat menambah atau mengubah endpoint, perbarui kontrak tersebut; contract test akan gagal bila endpoint operasional utama hilang.

## Feature flag

Feature flag tersimpan sebagai JSON pada key KV `feature:flags:v1`. Fitur yang sudah dipasang dalam keadaan tidak aktif dapat dinyalakan tanpa deploy dengan memperbarui key tersebut pada namespace `E_POSYANDU_CACHE`.

```json
{
  "csvExport": false,
  "largeExports": false,
  "notifications": false,
  "webhooks": false,
  "fileUploads": false
}
```

Nilai yang hilang atau bukan boolean dianggap `false`. Endpoint terautentikasi `GET /api/v1/features` hanya mengembalikan daftar flag yang diizinkan kode.

## Monitoring

Cloudflare Pages Functions Observability aktif 100% di staging dan disampling
10% di production untuk menekan pemakaian log. Log request berbentuk JSON dan
berisi `request_id`, route, status, latency, dan environment. Respons API juga
mengembalikan header `X-Request-ID` untuk penelusuran error.

Pantau setiap hari pada masa awal rilis:

| Metrik | Lokasi | Tindakan awal |
| --- | --- | --- |
| Error 4xx/5xx dan latency | Cloudflare Pages > Functions Observability | Periksa log berdasarkan `request_id`; waspadai 5xx > 1% atau p95 > 1 detik |
| Cache hit data dinamis | Log event `dynamic_redis_cache` | Setelah cache hangat, periksa bila HIT tetap di bawah 60% |
| Request, subrequest, CPU, bandwidth | Cloudflare Pages > Metrics | Cari endpoint dengan lonjakan subrequest atau waktu CPU |
| Egress database | Supabase > Usage | Bandingkan pemakaian harian; periksa ekspor besar dan full sync |
| Login dibatasi | Log status 429 dan Upstash | Pastikan bukan salah konfigurasi Redis atau serangan berulang |
| Data processing worker | Dashboard Ahli Gizi dan key Redis `monitoring:data-processing-worker:v1` | Alarm setelah 3 kegagalan beruntun; periksa Oracle, Caddy, dan Queue |

Jangan menulis NIK, KK, nama balita, token, password, atau isi formulir ke log runtime.

## Replika baca Neon (diarsipkan)

Oracle PostgreSQL menangani seluruh baca/tulis production. Neon dan private Neon
Read Worker tidak lagi menjadi bagian dari runtime maupun pipeline deployment;
artefaknya disimpan di `backend/legacy-cloudflare-worker` untuk audit dan
pemulihan historis saja. Migration replika tetap ada agar instalasi lama dapat
ditelusuri, tetapi jangan mengaktifkan `READ_REPLICA_MODE` pada environment baru.

Pemeriksaan terpadu tersedia pada `GET /api/v1/health/ready`. Endpoint ini memeriksa konfigurasi database, Redis dinamis, KV global, Queue, R2, dan status data-processing worker tanpa membaca data balita. GitHub Actions menjalankannya pada Senin-Jumat pukul 07.07-16.00 WIB bersama pemeriksaan frontend dan health worker Oracle melalui `system-monitor.yml`. Pemeriksaan manual tetap dapat dijalankan kapan saja.

Jalankan pemeriksaan yang sama dari komputer pengelola dengan:

```bash
npm run monitor:system
```

Laporan JSON dapat disimpan dengan `MONITOR_OUTPUT_PATH=/lokasi/laporan.json`. Hasil terjadwal disimpan sebagai artifact GitHub selama 14 hari agar tren kegagalan dapat ditelusuri.

Error JavaScript setelah pengguna login dikirim ke `POST /api/v1/client-errors`. Payload hanya berisi jenis error, route tanpa query, sumber, dan frame stack; pesan error serta data formulir tidak dikirim.

Pelanggaran Content Security Policy dikirim browser ke `POST /api/v1/security/csp-report`. Endpoint publik ini membatasi isi 16 KiB dan 60 laporan per IP per jam. Log hanya menyimpan directive, disposition, status HTTP, URL dokumen tanpa kredensial/query/fragment, serta origin sumber yang diblokir. IP mentah, `script-sample`, policy lengkap, referrer, NIK, dan isi form tidak dicatat.

Monitoring memeriksa health endpoint Oracle setiap 10 menit pada Senin-Jumat
pukul 07.00-16.00 WIB. Status sementara disimpan di Redis dan dibaca dashboard
hanya oleh Ahli Gizi. Untuk alarm di luar aplikasi, isi secret HTTPS
`MONITORING_ALERT_WEBHOOK_URL`, atau isi `RESEND_API_KEY`,
`MONITORING_ALERT_EMAIL_TO`, dan `ERROR_REPORT_EMAIL_FROM`. Alarm dikirim saat
kegagalan ketiga dan sekali lagi saat layanan pulih, tanpa membawa data balita.

## Backup dan uji restore

Buat backup sebelum migration dan secara terjadwal sesuai kebijakan Puskesmas:

```bash
DATABASE_URL='postgresql://...' npm run db:backup
```

File berada di folder `backups/`, berizin privat, dan tidak masuk Git. Simpan hasil backup pada media terenkripsi dengan akses terbatas. Uji restore harus memakai database non-production yang berbeda:

```bash
RESTORE_DATABASE_URL='postgresql://database-uji' \
CONFIRM_RESTORE_DRILL=RESTORE-TEST \
npm run db:restore-drill -- backups/e-posyandu-YYYYMMDDTHHMMSSZ.dump
```

Lakukan uji restore sedikitnya setiap tiga bulan dan sebelum migration destruktif. Script menolak target yang sama dengan `DATABASE_URL` bila keduanya diberikan. Workflow juga membandingkan fingerprint host, port, pengguna, dan nama database sumber dengan target agar restore tidak dapat diarahkan kembali ke database produksi.

Workflow `database-backup.yml` membuat backup mingguan dan hanya mengunggah dump yang sudah dienkripsi AES-256. Artifact terenkripsi disimpan 14 hari. Aktifkan dengan repository variable `ENABLE_SCHEDULED_BACKUP=true`, lalu isi secret berikut pada GitHub Environment `production`:

- `DATABASE_URL`
- `BACKUP_ENCRYPTION_PASSWORD` minimal 24 karakter acak

Uji restore bulanan bersifat opt-in karena akan membuat ulang schema aplikasi `public` pada database target. Schema internal dan event trigger Supabase tidak disentuh. Data `public.app_users` tetap ada di archive terenkripsi, tetapi sengaja tidak dimuat pada drill karena bergantung pada pengguna `auth.users` milik project sumber. Isi `RESTORE_DATABASE_URL` dan salinan `BACKUP_ENCRYPTION_PASSWORD` pada Environment `staging`, lalu set `ENABLE_MONTHLY_RESTORE_DRILL=true`. Uji restore juga dapat dipicu manual dengan opsi `run_restore_drill`. Database target wajib khusus pengujian dan tidak boleh berisi data aktif.

Sebelum dienkripsi, workflow menjalankan `npm run db:backup:verify -- <file.dump>` untuk memastikan archive dapat dibaca serta memuat tabel `children`, `measurements`, dan `schema_migrations`. Setelah restore, drill kembali memeriksa tabel wajib, jumlah data, dan migration terbaru. Jangan menyalakan kedua variable jadwal sebelum seluruh secret tersedia; workflow sengaja gagal tertutup bila satu secret kosong.

## Load test Queue dan gRPC

Load test gRPC lokal memakai data sintetis tanpa identitas nyata:

```bash
LOAD_GRPC_REQUESTS=50 \
LOAD_GRPC_CONCURRENCY=8 \
LOAD_GRPC_ITEMS=250 \
npm run data-processing:load
```

Alur production lengkap REST -> Queue -> worker gRPC diuji secara manual melalui workflow `load-test.yml`. Buat GitHub Environment `load-test`, lalu isi secret `LOAD_SUPABASE_URL`, `LOAD_SUPABASE_PUBLISHABLE_KEY`, `LOAD_TEST_EMAIL`, dan `LOAD_TEST_PASSWORD`. Email dan kata sandi harus milik akun khusus pengujian yang memiliki akses Ahli Gizi. Workflow membuat access token baru pada awal setiap pengujian, sehingga token sesi yang kedaluwarsa tidak perlu disimpan. Setelah itu pilih **Actions > Queue and gRPC Load Test > Run workflow**. Batas keras script adalah 50 job, paralel 10, dan 1.000 data sintetis per job agar pengujian tidak menghabiskan kuota gratis secara tidak sengaja.

## Konflik sinkronisasi offline

Setiap update dan hapus membawa `version` serta `updatedAt` yang terakhir dilihat perangkat. Server mengembalikan `409` dan dokumen terkini bila data sudah berubah. Perubahan pada kolom berbeda digabung otomatis dengan three-way merge. Bila perangkat dan server mengubah kolom yang sama, aplikasi menyimpan konflik di IndexedDB dan meminta pengguna memilih **Gunakan Data Saya** atau **Gunakan Data Server**. Antrean tetap idempotent dan hanya mengirim satu perubahan per dokumen dalam setiap batch, sehingga urutan perubahan tidak terbalik.

## Penyimpanan

PostgreSQL tetap menjadi sumber data tunggal. IndexedDB menyimpan cache dan antrean offline per perangkat. Redis menyimpan data domain dinamis selama maksimal 5 menit, sedangkan dashboard operasional maksimal 60 detik; key dipisahkan menurut cakupan akses dan state backend memiliki TTL masing-masing. Cloudflare KV hanya menyimpan data global yang jarang berubah seperti feature flag, menu, dan referensi; KV tidak menyimpan data balita, penimbangan, sesi, atau token.

Cloudflare R2 aktif untuk hasil ekspor besar dan lampiran privat. Jalur upload worker dibatasi 50 MB, berkas hanya dapat diunduh oleh pemilik job atau Ahli Gizi, dan PostgreSQL hanya menyimpan metadata objek.

Bucket memakai kelas Standard. Objek sementara `jobs/` kedaluwarsa setelah 7 hari. Cron Worker memeriksa kapasitas bersama jadwal jam kerja; ketika total mencapai 9 GiB, file job tertua dihapus sampai kapasitas turun ke 8 GiB. Batas pengaman ini sengaja lebih rendah dari jatah gratis 10 GB. Lampiran permanen tidak dihapus otomatis.

Saat membuat environment Cloudflare baru, aktivasi akun R2 dilakukan satu kali melalui Dashboard, lalu jalankan:

```bash
npm run r2:prepare
```

Kemudian deploy Worker dan pastikan endpoint monitoring menampilkan `r2Configured: true`. Ahli Gizi menerima peringatan bila kapasitas tidak dapat diturunkan karena file yang tersisa bukan file sementara.

MQTT sengaja tidak dipasang sebelum ada timbangan digital atau sensor IoT. Keputusan dan syarat keamanannya tercatat di `docs/decisions/001-mqtt-deferred.md`.
