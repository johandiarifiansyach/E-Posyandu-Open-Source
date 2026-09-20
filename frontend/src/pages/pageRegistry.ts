// SPDX-License-Identifier: GPL-3.0-or-later


import AddChildPage from './AddChildPage';
import AnalisisGiziPage from './AnalisisGizi';
import AdminBackendPage from './AdminBackendPage';
import AdminInvitePage from './AdminInvitePage';
import AdminMonitoringPage from './AdminMonitoringPage';
import ChangeHistoryPage from './ChangeHistoryPage';
import ChildrenTablePage from './ChildrenTablePage';
import DashboardPage from './DashboardPage';
import ExclusiveBreastfeedingPage from './ExclusiveBreastfeedingPage';
import MeasurementPage from './MeasurementPage';
import MpasiPage from './MpasiPage';
import PmtProgramPage from './PmtProgramPage';
import ProblemUnderweightPage from './ProblemUnderweightPage';
import ProblemStuntingPage from './ProblemStuntingPage';
import ProblemWastingPage from './ProblemWastingPage';
import ProblemTidakNaikPage from './ProblemTidakNaikPage';
import RecentChildrenPage from './RecentChildrenPage';
import RecycleBinPage from './RecycleBinPage';

/**
 * Canonical page map used by the React migration. Keeping the mapping in one
 * place prevents a route from silently falling back to a different module.
 */
export const reactPageRegistry = {
  dashboard: DashboardPage,
  analisis_gizi: AnalisisGiziPage,
  data_balita: ChildrenTablePage,
  measurement: MeasurementPage,
  add_child: AddChildPage,
  asi_eksklusif: ExclusiveBreastfeedingPage,
  mpasi: MpasiPage,
  pmt_program: PmtProgramPage,
  change_history: ChangeHistoryPage,
  admin_backend: AdminBackendPage,
  admin_monitoring: AdminMonitoringPage,
  admin_invite: AdminInvitePage,
  problem_underweight: ProblemUnderweightPage,
  problem_stunting: ProblemStuntingPage,
  problem_wasting: ProblemWastingPage,
  problem_tidak_naik: ProblemTidakNaikPage,
  recent: RecentChildrenPage,
  recycle_bin: RecycleBinPage
};

export type ReactPageId = keyof typeof reactPageRegistry;
