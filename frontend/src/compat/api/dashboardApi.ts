// SPDX-License-Identifier: GPL-3.0-or-later


/** Dashboard, monitoring, change history, and background jobs. */
export type {
  BackgroundJob,
  BackgroundJobKind,
  DashboardStatsRequest,
  DashboardStatsResponse,
  FeatureFlags,
  MonitoringStatus
} from './legacyClient';

export {
  createBackgroundJob,
  getBackgroundJob,
  getChangeHistory,
  getDashboardStats,
  getFeatureFlags,
  getMonitoringStatus,
  reportClientError,
  waitForBackgroundJob
} from './legacyClient';
