// SPDX-License-Identifier: GPL-3.0-or-later


import { Route, Routes } from 'react-router-dom';
import AppShell from '../app/AppShell';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="*" element={<AppShell />} />
    </Routes>
  );
}
