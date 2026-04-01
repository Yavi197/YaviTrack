// This file contains the Firebase configuration loaded from environment variables.
// IMPORTANT: Never hardcode credentials. Use environment variables instead.
// This file should be added to .gitignore to prevent sensitive credentials from being committed.

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Debug: Log if config is loaded
if (typeof window !== 'undefined') {
  console.log('[Firebase Config] Loaded config:', {
    apiKey: firebaseConfig.apiKey ? '✓ Present' : '✗ Missing',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
  
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
    console.warn('[Firebase Config] Missing environment variables:', {
      apiKey: !!firebaseConfig.apiKey,
      authDomain: !!firebaseConfig.authDomain,
      projectId: !!firebaseConfig.projectId,
    });
  }
}
