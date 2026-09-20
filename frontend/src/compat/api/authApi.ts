// Copyright (C) 2026 Johandi Arifiansyach

/** Authentication and session API. */
export type {
  AccessProfile,
  AuthenticatedSignInResult,
  Auth,
  AuthUser,
  MfaFactor,
  MfaPendingSignIn,
  SignInResult
} from './legacyClient';

export {
  expireAuthSession,
  challengeMfaFactor,
  completeAdminInvitation,
  enrollMfaFactor,
  getAuth,
  getCurrentAccessProfile,
  isAuthenticationError,
  initializeApp,
  onAuthStateChanged,
  reportAccountPresence,
  restoreAuthSession,
  signInAnonymously,
  signInWithPassword,
  signOut,
  verifyMfaFactor,
  startPasskeyRegistration,
  verifyPasskeyRegistration,
  startPasskeyAuthentication,
  verifyPasskeyAuthentication
} from './legacyClient';
