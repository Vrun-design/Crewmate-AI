import { initializeApp, getApps } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  isSignInWithEmailLink,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

const PENDING_EMAIL_KEY = 'crewmate_pending_email';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

function isForceLocalAuthEnabled(): boolean {
  return import.meta.env.VITE_FORCE_LOCAL_AUTH === 'true' || import.meta.env.VITE_FORCE_LOCAL_PREVIEW === 'true';
}

function hasFirebaseConfig(): boolean {
  if (isForceLocalAuthEnabled()) {
    return false;
  }

  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.appId);
}

function getFirebaseAuth() {
  if (!hasFirebaseConfig()) {
    return null;
  }

  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence);
  return auth;
}

export const firebaseAuthService = {
  isConfigured(): boolean {
    return hasFirebaseConfig();
  },
  async signInWithGoogle(): Promise<User> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth is not configured for this build.');
    }

    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },
  async sendEmailLink(email: string): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth is not configured for this build.');
    }

    window.localStorage.setItem(PENDING_EMAIL_KEY, email);
    await sendSignInLinkToEmail(auth, email, {
      url: `${window.location.origin}/verify`,
      handleCodeInApp: true,
    });
  },
  isEmailLink(url: string): boolean {
    const auth = getFirebaseAuth();
    return auth ? isSignInWithEmailLink(auth, url) : false;
  },
  getPendingEmail(): string {
    return window.localStorage.getItem(PENDING_EMAIL_KEY) ?? '';
  },
  async completeEmailLink(email: string, url: string): Promise<User> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth is not configured for this build.');
    }

    const result = await signInWithEmailLink(auth, email, url);
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
    return result.user;
  },
  async getIdToken(forceRefresh = false): Promise<string> {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser ?? null;
    return user ? user.getIdToken(forceRefresh) : '';
  },
  onIdTokenChanged(callback: (user: User | null) => void): (() => void) | null {
    const auth = getFirebaseAuth();
    return auth ? onIdTokenChanged(auth, callback) : null;
  },
  async signOut(): Promise<void> {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
  },
};
