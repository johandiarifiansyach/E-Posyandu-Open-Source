// SPDX-License-Identifier: GPL-3.0-or-later


/**
 * Shared API contracts.
 *
 * The request implementation remains in `legacyClient` for now so this
 * refactor does not alter retries, offline fallback, or authentication.
 * Domain modules expose the public operations without duplicating transport
 * behavior.
 */
export type {
  ApiDocument,
  DocumentData,
  QueryDocumentSnapshot,
  QuerySnapshot
} from './legacyClient';
