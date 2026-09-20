# Rekomendasi Arsitektur Rust–Python

Dokumen ini adalah acuan kerja bertahap untuk menutup kelemahan teknis Rust
dan Python pada E-Posyandu. Poin dikerjakan satu per satu, diuji lokal, dan
tidak otomatis dideploy.

## 1. Pastikan jalur baca tidak bergantung pada Python

```text
Rust → Redis
       ↓ miss
     PostgreSQL hasil analisis
       ↓ belum ada
     hasil terakhir yang valid / status diperbarui
```

Jangan tampilkan error “Cache halaman Python belum tersedia”. Jika Python
sedang sibuk, Rust harus mengembalikan snapshot terakhir atau skeleton, bukan
halaman kosong.

## 2. Gunakan transaksi dan outbox

```text
Rust menyimpan data mentah
        ↓
PostgreSQL commit + analysis_outbox dalam transaksi yang sama
        ↓
Python worker memproses data terdampak
        ↓
hasil analisis disimpan ke PostgreSQL
        ↓
cache versi lama dianggap stale
```

Dengan demikian tidak ada data mentah yang tersimpan tanpa tugas analisis.

## 3. Python hanya memproses data terdampak

Python tidak menghitung ulang seluruh database. Proses hanya untuk:

- balita yang baru ditambah atau diubah;
- riwayat pengukuran anak tersebut;
- ASI/MPASI anak tersebut;
- agregasi desa, posyandu, dan periode yang terdampak.

Gunakan `input_hash`, `source_version`, dan `analysis_version` agar proses
idempoten dan tidak menghitung data yang sama dua kali.

## 4. Optimalkan Python secara selektif

- Gunakan NumPy untuk perhitungan numerik batch jika profiling membuktikan perlu.
- Gunakan Pandas/Polars untuk statistik dan pelatihan offline, bukan setiap request.
- Gunakan worker multiprocessing untuk batch besar.
- Gunakan cache hasil WHO dan hasil grafik.
- Simpan grafik yang sudah dibuat agar tidak dirender ulang setiap kali dibuka.

## 5. Optimalkan Rust dan PostgreSQL

- Connection pooling.
- Prepared statement.
- Indeks untuk `unit_id`, `desa_id`, `posyandu_id`, `measurement_date`, dan kelompok umur.
- Pagination wajib; jangan mengambil 30 ribu pengukuran sekaligus.
- Materialized result table untuk tabel balita dan dashboard.
- Query agregasi sederhana tetap dikerjakan PostgreSQL.

## 6. Perkuat batas Rust–Python

Gunakan protobuf/gRPC dengan:

- schema versioning;
- backward compatibility;
- timeout;
- retry terbatas;
- circuit breaker;
- validasi request dan response;
- generated client yang sama versinya.

## 7. Tutup kelemahan operasional

Tambahkan monitoring untuk:

- cache hit/miss;
- waktu query PostgreSQL;
- waktu analisis Python;
- panjang antrean;
- jumlah retry dan dead-letter;
- penggunaan CPU/RAM;
- hasil analisis stale;
- kegagalan grafik.

Jika Python tidak sehat, Rust tetap melayani data hasil analisis terakhir.

## 8. Deployment dan keamanan

- Rust dan Python dijalankan sebagai service/container terpisah.
- Health check dan readiness check.
- Rolling atau blue-green deployment.
- Migrasi database backward-compatible.
- Secret gRPC hanya di jaringan internal.
- Backup PostgreSQL dan uji pemulihan berkala.

## 9. Pengujian skala nyata

Uji dengan minimal:

- 3.700 balita;
- 30.000 pengukuran;
- banyak kader mengakses bersamaan;
- Python mati sementara;
- Redis kosong;
- antrean analisis menumpuk;
- perubahan data bersamaan.

Target akhirnya:

```yaml
Read normal       : Rust → Redis/PostgreSQL
Write perubahan   : Rust → PostgreSQL → Queue
Analysis          : Python worker
Persistence       : PostgreSQL
Realtime          : PostgreSQL NOTIFY → Rust → SSE
Graph             : Python → cache/database
```

Rust tidak dibebani analitik dan Python tidak dibebani seluruh request
pengguna. Kompleksitas dua bahasa dikendalikan melalui kontrak gRPC, worker,
versioning, cache, dan monitoring.

## Pemisahan service yang diterapkan

Gateway `oracle-api` tetap menjadi satu-satunya endpoint HTTPS publik. Di
jaringan internal, request dipisah berdasarkan tanggung jawab:

```text
Browser → oracle-api
             ├─ identity-service   (login, MFA, akun)
             ├─ read-service       (GET tabel/dashboard + POST analisis)
             ├─ write-service      (POST/PATCH/DELETE mutasi + outbox)
             ├─ realtime-service   (PostgreSQL NOTIFY → SSE)
             ├─ monitoring-service (metrik operasional)
             └─ analysis-worker    (Rust/PyO3 → CPython untuk analitik)
```

`read-service` dibangun dengan `ORACLE_API_NATIVE_WRITES_ENABLED=false`, dan
`write-service` dengan `ORACLE_API_NATIVE_READS_ENABLED=false`; pembatasan ini
berlaku di gateway, kontrak gRPC, dan domain handler. `operations-service`
masih ada pada Compose profile `legacy` untuk rollback, tetapi tidak ikut
jalur produksi. Transport satu host menggunakan UDS `/run/e-posyandu/read.sock`
dan `/run/e-posyandu/write.sock`; URL TCP tetap tersedia untuk pemisahan VM.

## Status pengerjaan

- Poin 1: implementasi lokal tersedia; belum dideploy.
- Poin 2: implementasi lokal tersedia; persistensi snapshot dashboard memakai
  queue Python berbatas dan retry; belum dideploy.
- Poin 3: implementasi lokal tersedia; worker hanya memproses child yang
  terdampak, memakai `input_hash` dan `source_version`, serta mempertahankan
  `analysis_version` ketika input tidak berubah; belum dideploy.
- Poin 4: implementasi lokal tersedia; operasi LMS dan hasil SVG grafik memakai
  cache bounded process-local, sedangkan NumPy/Pandas/Polars dipisahkan untuk
  batch/offline melalui requirements training; belum dideploy.
- Poin 5: implementasi lokal tersedia; Rust memakai pool PostgreSQL berbatas
  dengan timeout tunggu/buat/recycle dan prepared statement cache, sedangkan
  migrasi 044 menambah indeks jalur baca untuk paging, join riwayat, hasil
  Python, dan snapshot dashboard; belum dideploy.
- Poin 6–9: belum dikerjakan dan harus dilakukan bertahap setelah poin
  sebelumnya diverifikasi.
