import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { serverConfig } from '../config';

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n');
}

function ensureFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  if (!serverConfig.firebaseProjectId.trim()) {
    throw new Error('Firebase Auth is not configured on the server.');
  }

  if (serverConfig.firebaseClientEmail.trim() && serverConfig.firebasePrivateKey.trim()) {
    return initializeApp({
      credential: cert({
        projectId: serverConfig.firebaseProjectId,
        clientEmail: serverConfig.firebaseClientEmail,
        privateKey: normalizePrivateKey(serverConfig.firebasePrivateKey),
      }),
      projectId: serverConfig.firebaseProjectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: serverConfig.firebaseProjectId,
  });
}

export function isFirebaseAuthEnabled(): boolean {
  return Boolean(serverConfig.firebaseProjectId.trim());
}

export async function verifyFirebaseIdToken(idToken: string) {
  ensureFirebaseApp();
  return getAuth().verifyIdToken(idToken, true);
}
