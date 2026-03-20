

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from "./firebaseConfig";

// Validate config
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error('[Firebase Init] Invalid configuration:', firebaseConfig);
  throw new Error('Firebase configuration is missing required fields');
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
// Use the specific Firestore database: san-sebastian-ips
const db = getFirestore(app, 'san-sebastian-ips');
const storage = getStorage(app);

// Connect to emulators in development (if running)
// DISABLED: Emulator requires Java. Using real Firebase instead.
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   try {
//     if (!auth.emulatorConfig && location.hostname === 'localhost') {
//       try {
//         connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
//         connectFirestoreEmulator(db, 'localhost', 8080);
//         console.log('[Firebase] Connected to emulators');
//       } catch (error) {
//         // Emulators not running, that's ok
//       }
//     }
//   } catch (error) {
//     console.log('[Firebase] Emulators not available');
//   }
// }

export { app, auth, db, storage };