// Copyright (C) 2026 Johandi Arifiansyach

import { APP_VERSION } from '../config/app';

export type ReleaseNote = { version: string; date: string; changes: string[] };
export const RELEASE_NOTES: ReleaseNote[] = [{
  version: APP_VERSION,
  date: '2026',
  changes: [
    'Frontend React + TSX menggunakan komponen strict tanpa renderer DOM lama.',
    'Dashboard dan tabel menampilkan data operasional dari API tanpa modul analisis gizi machine learning.',
    'Jalur baca memakai hasil persisten Rust/Redis/PostgreSQL dengan skeleton dan snapshot fallback.'
  ]
}];
