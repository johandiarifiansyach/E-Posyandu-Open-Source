# Data Processing Service

Layanan Rust internal untuk pekerjaan berat E-Posyandu. Browser tidak pernah
memanggil gRPC secara langsung. API membuat job, queue adapter menahannya,
pull consumer mengambil job secara berurutan, lalu gRPC memprosesnya tanpa
membebani endpoint login dan CRUD.

## Pekerjaan yang didukung

| Job | RPC | Hasil |
| --- | --- | --- |
| `import_validation` | `ValidateImport` | Pemeriksaan NIK, tanggal, BB, TB, umur, duplikat, dan cakupan wilayah |
| `nutrition_report` | `ProcessJob` | Job diteruskan ke `analysis-worker` Rust/PyO3 (modul Python) untuk kalkulasi WHO |
| `export_file` | `PrepareExport` | Berkas XLSX atau PDF beserta checksum SHA-256 |
| `system_sync` | `NormalizeSyncBatch` | Data sinkronisasi yang sudah dinormalisasi dan divalidasi |

`ProcessJob` menjadi pintu masuk Queue untuk keempat jenis job tersebut. Service
ini tidak menghitung status gizi; ia hanya memvalidasi, menormalisasi,
mengekspor, dan mengorkestrasi job ke service pemrosesan yang tepat.

Job `nutrition_report` mendelegasikan seluruh kalkulasi WHO ke
`analysis-worker` Rust/PyO3 melalui gRPC/UDS (`ANALYSIS_GRPC_ENABLED=true`).
Tidak ada fallback kalkulator lokal di service ini; bila analysis service belum
aktif, job gagal dengan status `failed_precondition` agar tidak ada hasil gizi
yang dihitung oleh komponen yang salah.

## Menjalankan lokal

```bash
cp backend/services/data-processing-service/.env.example backend/services/data-processing-service/.env
set -a
source backend/services/data-processing-service/.env
set +a
npm run data-processing:dev
```

Alamat lokal bawaan adalah UDS `unix:///tmp/e-posyandu/data-processing.sock`;
pada container path-nya `/run/e-posyandu/data-processing.sock`. Gunakan
alamat TCP seperti `0.0.0.0:50051` hanya bila service dipanggil dari server
lain. Tanpa
`EPOSYANDU_QUEUE_CONSUMER_ENABLED=true`, service hanya membuka server gRPC dan
tidak membaca queue sebelum adapter dikonfigurasi.

Binary lokal dan container bernama `data-processing-worker`; binary ini membuka health check HTTP pada
`$PORT` dan menjaga server gRPC tetap privat pada jaringan service.

## Mengaktifkan Queue consumer

Isi environment berikut pada host privat layanan Rust:

- `EPOSYANDU_QUEUE_API_URL`, endpoint queue adapter
- `EPOSYANDU_QUEUE_ACCOUNT_ID` (bila provider memerlukannya)
- `EPOSYANDU_QUEUE_ID` dan `EPOSYANDU_QUEUE_TOKEN`
- `EPOSYANDU_API_URL`
- `EPOSYANDU_SHARED_SECRET`, secret internal service-to-service
- `EPOSYANDU_DATA_PROCESSING_GRPC_URL`, biasanya `unix:///tmp/e-posyandu/data-processing.sock` lokal atau
  `unix:///run/e-posyandu/data-processing.sock` pada Compose untuk service
  satu host atau `http://HOST:50051` untuk lintas server/platform

Consumer memperbarui progres pada 5%, 85%, 95%, dan 100%. Job gagal dicoba
ulang maksimal tiga kali. Hasil validasi, laporan, dan sinkronisasi disimpan
sebagai JSON di PostgreSQL. Hasil XLSX/PDF disimpan melalui storage adapter
privat; job ekspor akan gagal dengan pesan yang jelas bila adapter storage belum
diaktifkan.

Payload dibatasi 10.000 baris per job kalkulasi atau validasi dan 100.000
baris per ekspor. Untuk impor yang lebih besar, REST harus membaginya menjadi
beberapa job agar penggunaan memori dan waktu proses tetap terkendali.

## Container

Build image dari root repository agar seluruh kontrak proto dan sumber layanan ikut masuk:

```bash
docker build -f backend/services/data-processing-service/Dockerfile -t e-posyandu-data-processing-worker .
```

Container berjalan sebagai pengguna non-root. Platform hosting hanya membuka
port HTTP `$PORT` untuk health check, sedangkan gRPC hanya dibuka pada jaringan
privat antarservice dan tidak dipublish ke host. Environment Queue tetap
diberikan sebagai secret dari platform hosting, bukan dimasukkan ke image.

## Deployment pada platform pilihan

Gunakan image Docker yang sama pada VM, container platform, Kubernetes, atau
server on-premise. Template provider-neutral tersedia di
[`deploy/generic`](../../deploy/generic/README.md). Service pada satu host
dapat memakai UDS di `/run/e-posyandu`; bila dipisahkan, gunakan URL TCP privat.
Port gRPC dan health internal tidak perlu dipublish ke internet. Setiap panggilan
gRPC memerlukan metadata `x-eposyandu-service-token` dari
`EPOSYANDU_SHARED_SECRET`.

Jalankan tepat satu Queue consumer aktif untuk setiap antrean. Adapter historis
di [`deploy/oracle`](../../deploy/oracle/README.md), skrip `oracle:*`, dan
skrip platform lain tetap disimpan untuk deployment existing, tetapi bukan
default instalasi baru.

## Layanan gratis di macOS

Bila belum memakai host container berbayar, worker dapat dijalankan sebagai
LaunchAgent pada Mac ini. Layanan otomatis dimulai setelah pengguna masuk dan
diulang oleh macOS bila proses berhenti:

```bash
npm run data-processing:activate:macos
```

Pada aktivasi pertama, isi `EPOSYANDU_QUEUE_API_URL`,
`EPOSYANDU_QUEUE_ID`, dan `EPOSYANDU_QUEUE_TOKEN` pada konfigurasi privat.
Skrip adapter lama yang meminta token provider tertentu tetap tersedia untuk
deployment kompatibilitas.

Konfigurasi privat dibaca dari
`~/.config/e-posyandu/data-processing-worker.env`. Mac harus menyala dan terhubung ke
internet agar pekerjaan Queue diproses. Cara ini cocok sebagai aktivasi awal,
tetapi bukan pengganti host selalu aktif untuk penggunaan 24 jam.

Binary dan runner dipasang ke `~/Library/Application Support/EPosyandu` agar
LaunchAgent tidak memerlukan izin akses ke folder Documents. Jalankan ulang
`npm run data-processing:install:macos` setiap kali kode service Rust diperbarui.

## Hosting sementara atau development

Container menjalankan health check HTTP dan server gRPC privat pada proses yang
sama. Queue consumer hanya menghubungi gRPC melalui `127.0.0.1`, sehingga RPC
internal tidak dibuka ke internet. PostgreSQL dan API dapat ditempatkan pada
provider mana pun yang memenuhi kontrak pada `docs/INFRASTRUCTURE.md`.

Blueprint platform yang ada tetap dapat dipakai sebagai contoh adapter. Masukkan
environment umum melalui secret manager platform tersebut. Polling kosong
dibatasi setiap 15 detik dan satu pull memproses maksimal dua job agar penggunaan
CPU, RAM, serta operasi Queue tetap ringan.

Setelah deploy pertama selesai, sambungkan URL Render ke monitoring eksternal
bila masih diperlukan. Perintah ini hanya memeriksa health check dan tidak
mengaktifkan Worker API lama:

```bash
npm run data-processing:connect:render -- https://HOST-SERVICE.example/health
```

Gunakan hanya satu worker aktif untuk satu antrean agar job tidak diproses ganda.
