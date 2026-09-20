# E-Posyandu Open Source Demo

E-Posyandu adalah aplikasi pencatatan balita, pengukuran, ASI eksklusif,
MPASI, PMT, dan riwayat perubahan untuk lingkungan **Puskesmas Demo**.
Project ini adalah salinan demo dari E-Posyandu dengan UI/UX dan bahasa
program yang sama. Data lokasi dan akun di dalamnya sengaja menggunakan data
demo agar pengembang dapat menggantinya untuk instalasi masing-masing.

MCP server dan fitur analisis gizi berbasis machine learning tidak disertakan
pada distribusi ini. Runtime Python tetap tersedia untuk perhitungan WHO/LMS,
status N/T/O/B, ASI, statistik, dan grafik pertumbuhan yang deterministik.
Pengukuran, riwayat, dan formulir program tetap dapat digunakan sebagai data
operasional biasa.

## Data demo

- Puskesmas: `Puskesmas Demo`
- Desa: `Desa Demo`
- Posyandu: `Posyandu Demo 1` dan `Posyandu Demo 2`

Contoh akun (buat terlebih dahulu pada penyedia autentikasi yang digunakan):

| Peran | Username/email demo | Desa/Posyandu |
| --- | --- | --- |
| Administrator | `admin@demo.eposyandu.local` | Semua data |
| Ahli gizi | `gizi@demo.eposyandu.local` | Semua data |
| Bidan desa | `bidan@demo.eposyandu.local` | Desa Demo |
| Kader posyandu | `kader@demo.eposyandu.local` | Desa Demo / Posyandu Demo 1 |

Saat menjalankan frontend dengan Vite (`npm run dev`), akun demo dapat masuk
dengan password default **`Demo123!`**. Login lokal menerima email di atas,
atau username singkat `admin`, `gizi`, `bidan`, dan `kader`. Jalur demo ini
aktif hanya pada mode development dan otomatis tidak tersedia pada build
production. Ganti `VITE_DEMO_PASSWORD` pada `.env.local` bila diperlukan.

Untuk deployment nyata, buat akun pada penyedia autentikasi Anda, nonaktifkan
login demo, dan gunakan password unik serta MFA. Jangan memakai password demo
di production.

## Struktur

```text
frontend/        React + TypeScript (UI utama)
backend/         Gateway dan service API Rust
database/        Migrasi PostgreSQL/Supabase
docs/            Dokumentasi operasional
scripts/         Otomasi database dan deployment
tests/           Pengujian kontrak dan frontend
```

## Menjalankan frontend lokal

```bash
npm install
npm run dev
```

Pemeriksaan dan build frontend:

```bash
npm run frontend:check
npm run frontend:react:build
```

Konfigurasi endpoint API dan autentikasi berada pada file environment yang
digunakan oleh `frontend/`. Untuk menjalankan backend Rust, lihat
`backend/README.md` dan konfigurasi deployment yang sesuai dengan lingkungan
Anda.

## Menambahkan lokasi dan akun sendiri

Ubah `frontend/src/config/dashboard.ts`, konfigurasi kompatibilitas yang
bersesuaian, serta migrasi `database/migrations/005_seed_posyandu_users.sql`.
Buat user pada provider autentikasi, lalu hubungkan `user_id`, peran, desa, dan
posyandu pada tabel `app_users`. Jangan commit password, token, atau data
pribadi ke repository.

## Lisensi dan kontribusi

E-Posyandu Open Source dilisensikan di bawah **GNU General Public License
v3.0 (GPLv3), atau versi lebih baru**. Setiap distribusi atau karya turunan
wajib mempertahankan lisensi copyleft yang sama dan menyertakan sumber sesuai
ketentuan GPLv3. Teks lisensi tersedia pada file [`LICENSE`](LICENSE).

Kontribusi dipersilakan melalui pull request. Sebelum menambahkan kode,
pastikan dependensi dan asetnya kompatibel dengan GPLv3, lalu ikuti
`SECURITY.md` untuk pelaporan kerentanan.
