# Kebijakan keamanan

## Melaporkan kerentanan

Jangan membuat issue publik untuk kerentanan keamanan, kredensial yang bocor,
atau data pribadi. Gunakan [private vulnerability reporting di GitHub](https://github.com/johandiarifiansyach/E-POSYANDU-NEW/security/advisories/new)
agar detail dapat ditinjau secara privat.

Sertakan versi atau commit yang terdampak, langkah reproduksi, dampak yang
diperkirakan, dan bukti konsep yang tidak memuat data nyata. Jangan mengirim
password, token, private key, atau data pasien dalam laporan.

## Secret yang terlanjur terekspos

Jika secret muncul di commit, log, issue, atau artefak build:

1. Cabut atau rotasi secret tersebut segera pada penyedia layanannya.
2. Simpan pengganti hanya di secret manager atau konfigurasi CI.
3. Laporkan kejadian secara privat agar riwayat dan dampaknya dapat diperiksa.

Penghapusan file dari commit terbaru tidak menghapusnya dari riwayat Git.
